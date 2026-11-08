from datetime import date
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import CurrentEmployee, DbSession
from app.models.base import utcnow
from app.models.enums import NotificationType, ReportStatus
from app.models.report import DailyReport, DailyReportAttachment, DailyReportEntry
from app.models.user import User
from app.schemas.report import (
    ReportAttachmentOut,
    ReportCreate,
    ReportEntryCreate,
    ReportEntryOut,
    ReportEntryUpdate,
    ReportList,
    ReportOut,
    ReportSave,
    RevisionResponse,
)
from app.services.access import get_my_report, report_query
from app.services.activity import log_activity, notify_admins
from app.services.exports import build_reports_excel, build_reports_pdf
from app.services.files import delete_stored_file, save_upload
from app.services.reports import (
    build_entry,
    ensure_editable,
    ensure_hours_within_limit,
    has_report_for_date,
    replace_entries,
    suggested_entries_from_tasks,
    validate_refs,
)

router = APIRouter(prefix="/reports", tags=["daily reports"])

_REQUIRED_ENTRY_FIELDS = {"task_title", "work_description", "time_spent_hours", "work_status"}


def _ensure_date_allowed(report_date: date) -> None:
    if report_date > date.today():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Cannot create a report for a future date"
        )


def _fmt(d: date) -> str:
    return d.strftime("%b %d, %Y")


def _submit(db: Session, user: User, report: DailyReport, *, resubmit: bool) -> None:
    if not report.entries:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Add at least one work entry before submitting"
        )
    report.status = ReportStatus.SUBMITTED
    report.submitted_at = utcnow()
    verb = "Resubmitted" if resubmit else "Submitted"
    log_activity(
        db,
        user.id,
        "report_resubmitted" if resubmit else "report_submitted",
        "daily_report",
        report.id,
        description=f"{verb} daily report for {_fmt(report.report_date)}",
        report_date=report.report_date.isoformat(),
    )
    notify_admins(
        db,
        title=f"Daily report {verb.lower()}",
        message=f"{user.full_name} {verb.lower()} the daily report for {_fmt(report.report_date)}.",
        type=NotificationType.REPORT,
        link=f"/admin/reports/{report.id}",
    )


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate, user: CurrentEmployee, db: DbSession) -> DailyReport:
    """Create a draft report (optionally with initial entries)."""
    _ensure_date_allowed(payload.report_date)
    if has_report_for_date(db, user, payload.report_date):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"A report for {payload.report_date.isoformat()} already exists",
        )
    seed_entries = payload.entries or suggested_entries_from_tasks(db, user)
    ensure_hours_within_limit(sum(e.time_spent_hours for e in seed_entries))

    report = DailyReport(
        employee_id=user.id, report_date=payload.report_date, status=ReportStatus.DRAFT
    )
    db.add(report)
    db.flush()
    for e in seed_entries:
        report.entries.append(build_entry(db, user, report, e))
    log_activity(
        db,
        user.id,
        "report_created",
        "daily_report",
        report.id,
        description=f"Started daily report for {_fmt(report.report_date)}",
        report_date=report.report_date.isoformat(),
    )
    db.commit()
    return get_my_report(db, user, report.id)


@router.get("", response_model=ReportList)
def list_reports(
    user: CurrentEmployee,
    db: DbSession,
    report_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    status_filter: Annotated[ReportStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReportList:
    conditions = [DailyReport.employee_id == user.id]
    if report_date is not None:
        conditions.append(DailyReport.report_date == report_date)
    if date_from is not None:
        conditions.append(DailyReport.report_date >= date_from)
    if date_to is not None:
        conditions.append(DailyReport.report_date <= date_to)
    if status_filter is not None:
        conditions.append(DailyReport.status == status_filter)
    if project_id is not None:
        conditions.append(
            select(DailyReportEntry.id)
            .where(
                DailyReportEntry.report_id == DailyReport.id,
                DailyReportEntry.project_id == project_id,
            )
            .exists()
        )
    if search and search.strip():
        like = f"%{search.strip()}%"
        conditions.append(
            or_(
                select(DailyReportEntry.id)
                .where(
                    DailyReportEntry.report_id == DailyReport.id,
                    or_(
                        DailyReportEntry.task_title.ilike(like),
                        DailyReportEntry.work_description.ilike(like),
                        DailyReportEntry.achievement.ilike(like),
                        DailyReportEntry.challenges.ilike(like),
                    ),
                )
                .exists(),
                DailyReport.admin_feedback.ilike(like),
            )
        )

    total = db.scalar(select(func.count()).select_from(DailyReport).where(*conditions)) or 0
    items = db.scalars(
        report_query(user)
        .where(*conditions[1:])
        .order_by(DailyReport.report_date.desc(), DailyReport.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return ReportList(
        items=[ReportOut.model_validate(r) for r in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/today", response_model=ReportOut | None)
def get_todays_report(user: CurrentEmployee, db: DbSession) -> DailyReport | None:
    return db.scalars(report_query(user).where(DailyReport.report_date == date.today())).first()


@router.get("/suggested-entries", response_model=list[ReportEntryCreate])
def get_suggested_entries(user: CurrentEmployee, db: DbSession) -> list[ReportEntryCreate]:
    """Project-wise work entries auto-built from the employee's current tasks."""
    return suggested_entries_from_tasks(db, user)


def _report_filter_conditions(
    user: User,
    *,
    report_date: date | None,
    date_from: date | None,
    date_to: date | None,
    project_id: int | None,
    status_filter: ReportStatus | None,
    search: str | None,
) -> list[Any]:
    conditions: list[Any] = [DailyReport.employee_id == user.id]
    if report_date is not None:
        conditions.append(DailyReport.report_date == report_date)
    if date_from is not None:
        conditions.append(DailyReport.report_date >= date_from)
    if date_to is not None:
        conditions.append(DailyReport.report_date <= date_to)
    if status_filter is not None:
        conditions.append(DailyReport.status == status_filter)
    if project_id is not None:
        conditions.append(
            select(DailyReportEntry.id)
            .where(
                DailyReportEntry.report_id == DailyReport.id,
                DailyReportEntry.project_id == project_id,
            )
            .exists()
        )
    if search and search.strip():
        like = f"%{search.strip()}%"
        conditions.append(
            or_(
                select(DailyReportEntry.id)
                .where(
                    DailyReportEntry.report_id == DailyReport.id,
                    or_(
                        DailyReportEntry.task_title.ilike(like),
                        DailyReportEntry.work_description.ilike(like),
                        DailyReportEntry.achievement.ilike(like),
                        DailyReportEntry.challenges.ilike(like),
                    ),
                )
                .exists(),
                DailyReport.admin_feedback.ilike(like),
            )
        )
    return conditions


def _export_report_rows(
    user: CurrentEmployee,
    db: DbSession,
    *,
    report_date: date | None,
    date_from: date | None,
    date_to: date | None,
    project_id: int | None,
    status_filter: ReportStatus | None,
    search: str | None,
) -> list[dict[str, Any]]:
    conditions = _report_filter_conditions(
        user,
        report_date=report_date,
        date_from=date_from,
        date_to=date_to,
        project_id=project_id,
        status_filter=status_filter,
        search=search,
    )
    items = db.scalars(
        report_query(user)
        .where(*conditions[1:])
        .order_by(DailyReport.report_date.desc(), DailyReport.id.desc())
        .limit(1000)
    ).all()
    rows: list[dict[str, Any]] = []
    for r in items:
        projects = sorted(
            {
                e.project.name
                for e in r.entries
                if e.project is not None and e.project.name
            }
        )
        task_titles = [e.task_title for e in r.entries if e.task_title]
        rows.append(
            {
                "report_date": r.report_date.isoformat(),
                "status": r.status.value,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else "",
                "entry_count": len(r.entries),
                "total_hours": round(sum(e.time_spent_hours for e in r.entries), 2),
                "tasks": " · ".join(task_titles),
                "projects": ", ".join(projects),
                "admin_feedback": r.admin_feedback or "",
                "employee_response": r.employee_response or "",
                "entries_detail": [
                    {
                        "task_title": e.task_title,
                        "project_id": e.project_id,
                        "project": (
                            e.project.name
                            if e.project
                            else (e.project_name or "Personal")
                        ),
                        "hours": round(float(e.time_spent_hours or 0), 2),
                        "work_status": e.work_status.value if e.work_status else "",
                        "work_description": e.work_description or "",
                        "achievement": e.achievement or "",
                        "challenges": e.challenges or "",
                        "next_day_plan": e.next_day_plan or "",
                    }
                    for e in r.entries
                ],
            }
        )
    return rows


@router.get("/export/pdf")
def export_reports_pdf(
    user: CurrentEmployee,
    db: DbSession,
    report_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    status_filter: Annotated[ReportStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> Response:
    rows = _export_report_rows(
        user,
        db,
        report_date=report_date,
        date_from=date_from,
        date_to=date_to,
        project_id=project_id,
        status_filter=status_filter,
        search=search,
    )
    pdf = build_reports_pdf(rows, employee_name=user.full_name)
    filename = f"report-history-{date.today().isoformat()}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/export/excel")
def export_reports_excel(
    user: CurrentEmployee,
    db: DbSession,
    report_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    status_filter: Annotated[ReportStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> Response:
    rows = _export_report_rows(
        user,
        db,
        report_date=report_date,
        date_from=date_from,
        date_to=date_to,
        project_id=project_id,
        status_filter=status_filter,
        search=search,
    )
    xlsx = build_reports_excel(rows, employee_name=user.full_name)
    filename = f"report-history-{date.today().isoformat()}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, user: CurrentEmployee, db: DbSession) -> DailyReport:
    return get_my_report(db, user, report_id)


@router.put("/{report_id}", response_model=ReportOut)
def save_draft(
    report_id: int, payload: ReportSave, user: CurrentEmployee, db: DbSession
) -> DailyReport:
    """Save draft: optionally change the date and/or replace all entries.
    Allowed for draft and revision_requested reports."""
    report = get_my_report(db, user, report_id)
    ensure_editable(report)

    if payload.report_date is not None and payload.report_date != report.report_date:
        _ensure_date_allowed(payload.report_date)
        if has_report_for_date(db, user, payload.report_date):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"A report for {payload.report_date.isoformat()} already exists",
            )
        report.report_date = payload.report_date
    if payload.entries is not None:
        replace_entries(db, user, report, payload.entries)
    report.updated_at = utcnow()
    db.commit()
    return get_my_report(db, user, report.id)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(report_id: int, user: CurrentEmployee, db: DbSession) -> Response:
    report = get_my_report(db, user, report_id)
    if report.status != ReportStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Only draft reports can be deleted")
    paths = [a.file_path for a in report.attachments]
    db.delete(report)
    db.commit()
    for path in paths:
        delete_stored_file(path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- entries


def _get_entry(db: Session, report: DailyReport, entry_id: int) -> DailyReportEntry:
    entry = db.get(DailyReportEntry, entry_id)
    if entry is None or entry.report_id != report.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return entry


@router.post(
    "/{report_id}/entries", response_model=ReportEntryOut, status_code=status.HTTP_201_CREATED
)
def add_entry(
    report_id: int, payload: ReportEntryCreate, user: CurrentEmployee, db: DbSession
) -> DailyReportEntry:
    report = get_my_report(db, user, report_id)
    ensure_editable(report)
    ensure_hours_within_limit(
        sum(e.time_spent_hours for e in report.entries) + payload.time_spent_hours
    )
    entry = build_entry(db, user, report, payload)
    report.entries.append(entry)
    report.updated_at = utcnow()
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{report_id}/entries/{entry_id}", response_model=ReportEntryOut)
def update_entry(
    report_id: int,
    entry_id: int,
    payload: ReportEntryUpdate,
    user: CurrentEmployee,
    db: DbSession,
) -> DailyReportEntry:
    report = get_my_report(db, user, report_id)
    ensure_editable(report)
    entry = _get_entry(db, report, entry_id)

    changes = payload.model_dump(exclude_unset=True)
    for field in _REQUIRED_ENTRY_FIELDS:
        if field in changes and changes[field] is None:
            raise HTTPException(
                422, detail=f"{field} cannot be null"
            )

    if "time_spent_hours" in changes:
        others = sum(e.time_spent_hours for e in report.entries if e.id != entry.id)
        ensure_hours_within_limit(others + changes["time_spent_hours"])

    if "project_id" in changes or "related_task_id" in changes:
        project_id = changes.get("project_id", entry.project_id)
        task_id = changes.get("related_task_id", entry.related_task_id)
        changes["project_id"] = validate_refs(db, user, project_id, task_id)

    for field, value in changes.items():
        setattr(entry, field, value)
    report.updated_at = utcnow()
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{report_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    report_id: int, entry_id: int, user: CurrentEmployee, db: DbSession
) -> Response:
    report = get_my_report(db, user, report_id)
    ensure_editable(report)
    entry = _get_entry(db, report, entry_id)
    paths = [a.file_path for a in report.attachments if a.entry_id == entry.id]
    report.entries.remove(entry)
    report.updated_at = utcnow()
    db.commit()
    for path in paths:
        delete_stored_file(path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------------- attachments


@router.post(
    "/{report_id}/attachments",
    response_model=ReportAttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_attachment(
    report_id: int,
    user: CurrentEmployee,
    db: DbSession,
    file: Annotated[UploadFile, File(description="File to attach")],
    entry_id: Annotated[int | None, Form()] = None,
) -> DailyReportAttachment:
    report = get_my_report(db, user, report_id)
    ensure_editable(report)
    if entry_id is not None:
        _get_entry(db, report, entry_id)
    filename, path = save_upload(file, f"reports/{report.id}")
    attachment = DailyReportAttachment(
        report_id=report.id, entry_id=entry_id, filename=filename, file_path=path
    )
    db.add(attachment)
    report.updated_at = utcnow()
    db.commit()
    db.refresh(attachment)
    return attachment


@router.delete("/{report_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    report_id: int, attachment_id: int, user: CurrentEmployee, db: DbSession
) -> Response:
    report = get_my_report(db, user, report_id)
    ensure_editable(report)
    attachment = db.get(DailyReportAttachment, attachment_id)
    if attachment is None or attachment.report_id != report.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    path = attachment.file_path
    db.delete(attachment)
    db.commit()
    delete_stored_file(path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -------------------------------------------------------------------------- workflow


@router.post("/{report_id}/submit", response_model=ReportOut)
def submit_report(report_id: int, user: CurrentEmployee, db: DbSession) -> DailyReport:
    report = get_my_report(db, user, report_id)
    ensure_editable(report)
    _submit(db, user, report, resubmit=report.status == ReportStatus.REVISION_REQUESTED)
    db.commit()
    return get_my_report(db, user, report.id)


@router.post("/{report_id}/respond-revision", response_model=ReportOut)
def respond_to_revision(
    report_id: int, payload: RevisionResponse, user: CurrentEmployee, db: DbSession
) -> DailyReport:
    """Reply to an admin revision request (optionally updating entries) and resubmit."""
    report = get_my_report(db, user, report_id)
    if report.status != ReportStatus.REVISION_REQUESTED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="This report has no pending revision request"
        )
    if payload.entries is not None:
        replace_entries(db, user, report, payload.entries)
    report.employee_response = payload.message.strip()
    _submit(db, user, report, resubmit=True)
    db.commit()
    return get_my_report(db, user, report.id)
