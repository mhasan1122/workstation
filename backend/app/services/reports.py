from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import ReportStatus, TaskStatus, WorkStatus
from app.models.project import Project
from app.models.report import DailyReport, DailyReportEntry
from app.models.task import Task
from app.models.user import User
from app.schemas.report import ReportEntryCreate
from app.services.access import user_can_access_project

EDITABLE_STATUSES = (ReportStatus.DRAFT, ReportStatus.REVISION_REQUESTED)
MAX_HOURS_PER_DAY = 24.0

_TASK_TO_WORK: dict[TaskStatus, WorkStatus] = {
    TaskStatus.TODO: WorkStatus.NOT_STARTED,
    TaskStatus.IN_PROGRESS: WorkStatus.IN_PROGRESS,
    TaskStatus.ON_HOLD: WorkStatus.BLOCKED,
    TaskStatus.IN_REVIEW: WorkStatus.IN_PROGRESS,
    TaskStatus.COMPLETED: WorkStatus.COMPLETED,
}


def ensure_editable(report: DailyReport) -> None:
    if report.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Report is '{report.status.value}' and can no longer be edited. "
                "Only draft or revision_requested reports are editable."
            ),
        )


def validate_refs(
    db: Session, user: User, project_id: int | None, related_task_id: int | None
) -> int | None:
    """Make sure referenced project/task belong to the user. Returns the effective project_id."""
    if related_task_id is not None:
        task = db.get(Task, related_task_id)
        if task is None or task.assigned_to != user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid related_task_id")
        if project_id is None:
            project_id = task.project_id
    if project_id is not None and not user_can_access_project(db, user, project_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid project_id")
    return project_id


def ensure_hours_within_limit(total: float) -> None:
    if total > MAX_HOURS_PER_DAY:
        raise HTTPException(
            422,
            detail=f"Total time spent in a report cannot exceed {MAX_HOURS_PER_DAY:g} hours",
        )


def _project_name(db: Session, project_id: int | None) -> str | None:
    if project_id is None:
        return None
    project = db.get(Project, project_id)
    return project.name if project else None


def build_entry(
    db: Session, user: User, report: DailyReport, data: ReportEntryCreate
) -> DailyReportEntry:
    project_id = validate_refs(db, user, data.project_id, data.related_task_id)
    return DailyReportEntry(
        report_id=report.id,
        task_title=data.task_title,
        work_description=data.work_description,
        project_id=project_id,
        project_name=_project_name(db, project_id) or "Personal",
        related_task_id=data.related_task_id,
        time_spent_hours=data.time_spent_hours,
        work_status=data.work_status,
        achievement=data.achievement,
        challenges=data.challenges,
        next_day_plan=data.next_day_plan,
    )


def replace_entries(
    db: Session, user: User, report: DailyReport, entries: list[ReportEntryCreate]
) -> None:
    ensure_hours_within_limit(sum(e.time_spent_hours for e in entries))
    new_entries = [build_entry(db, user, report, e) for e in entries]
    report.entries.clear()
    db.flush()
    for entry in new_entries:
        report.entries.append(entry)


def has_report_for_date(db: Session, user: User, report_date: date) -> bool:
    return (
        db.scalar(
            select(DailyReport.id).where(
                DailyReport.employee_id == user.id, DailyReport.report_date == report_date
            )
        )
        is not None
    )


def suggested_entries_from_tasks(db: Session, user: User) -> list[ReportEntryCreate]:
    """Build report entries from the employee's tasks, grouped by project."""
    tasks = list(
        db.scalars(
            select(Task)
            .where(Task.assigned_to == user.id)
            .options(selectinload(Task.project))
            .order_by(Task.project_id.asc().nulls_last(), Task.id.asc())
        )
    )
    # Stable project-wise order: named projects A→Z, then personal tasks.
    tasks.sort(
        key=lambda t: (
            1 if t.project_id is None else 0,
            (t.project.name.lower() if t.project else ""),
            0 if t.status == TaskStatus.COMPLETED else 1,
            t.title.lower(),
        )
    )
    entries: list[ReportEntryCreate] = []
    for task in tasks:
        desc = (task.description or "").strip()
        if not desc:
            project_label = task.project.name if task.project else "Personal"
            desc = f"Worked on '{task.title}' ({project_label}). Progress: {task.progress}%."
        entries.append(
            ReportEntryCreate(
                task_title=task.title,
                work_description=desc,
                project_id=task.project_id,
                related_task_id=task.id,
                time_spent_hours=0.0,
                work_status=_TASK_TO_WORK.get(task.status, WorkStatus.IN_PROGRESS),
                achievement=None,
                challenges=None,
                next_day_plan=None,
            )
        )
        # project_name is stamped in build_entry when the report is saved.
    return entries
