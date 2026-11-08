from collections import defaultdict
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import MilestoneStatus, Priority, ReportStatus, TaskStatus
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.report import DailyReport, DailyReportEntry
from app.models.task import Task
from app.models.user import User
from app.schemas.performance import (
    BreakdownItem,
    MilestoneMetrics,
    PerformancePeriod,
    PerformanceResponse,
    ReportMetrics,
    TaskMetrics,
    TrendPoint,
)
from app.services.progress import average, to_local_date

MAX_CUSTOM_RANGE_DAYS = 731


def resolve_range(
    period: PerformancePeriod, start: date | None, end: date | None, today: date
) -> tuple[date, date]:
    """Calendar based ranges that end today (or the explicit end for custom)."""
    if period == PerformancePeriod.WEEKLY:
        return today - timedelta(days=today.weekday()), today
    if period == PerformancePeriod.MONTHLY:
        return today.replace(day=1), today
    if period == PerformancePeriod.QUARTERLY:
        first_month = 3 * ((today.month - 1) // 3) + 1
        return date(today.year, first_month, 1), today
    if period == PerformancePeriod.YEARLY:
        return date(today.year, 1, 1), today

    # custom
    if start is None or end is None:
        raise HTTPException(
            422,
            detail="`start` and `end` are required when period=custom",
        )
    if start > end:
        raise HTTPException(
            422, detail="`start` must be on or before `end`"
        )
    if (end - start).days > MAX_CUSTOM_RANGE_DAYS:
        raise HTTPException(
            422,
            detail=f"Custom range cannot exceed {MAX_CUSTOM_RANGE_DAYS} days",
        )
    return start, end


def _working_days(start: date, end: date) -> int:
    if end < start:
        return 0
    days = (end - start).days + 1
    return sum(1 for i in range(days) if (start + timedelta(days=i)).weekday() < 5)


def _bucket(d: date, span_days: int) -> date:
    if span_days <= 62:
        return d
    if span_days <= 200:
        return d - timedelta(days=d.weekday())
    return d.replace(day=1)


def _rating(score: float, has_data: bool) -> str:
    if not has_data:
        return "No data"
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Average"
    return "Needs improvement"


def build_performance(
    db: Session,
    user: User,
    period: PerformancePeriod,
    start: date | None,
    end: date | None,
) -> PerformanceResponse:
    today = date.today()
    start_date, end_date = resolve_range(period, start, end, today)
    span = (end_date - start_date).days + 1

    def in_range(d: date | None) -> bool:
        return d is not None and start_date <= d <= end_date

    # ---- tasks -----------------------------------------------------------
    all_tasks = db.scalars(select(Task).where(Task.assigned_to == user.id)).all()
    tasks = [
        t
        for t in all_tasks
        if in_range(t.deadline)
        or in_range(to_local_date(t.created_at))
        or (t.status == TaskStatus.COMPLETED and in_range(to_local_date(t.updated_at)))
    ]
    done = [t for t in tasks if t.status == TaskStatus.COMPLETED]
    done_with_deadline = [t for t in done if t.deadline]
    on_time = sum(1 for t in done_with_deadline if to_local_date(t.updated_at) <= t.deadline)  # type: ignore[operator]
    task_progress = [100 if t.status == TaskStatus.COMPLETED else t.progress for t in tasks]

    def tcount(s: TaskStatus) -> int:
        return sum(1 for t in tasks if t.status == s)

    task_metrics = TaskMetrics(
        total=len(tasks),
        completed=len(done),
        in_progress=tcount(TaskStatus.IN_PROGRESS),
        in_review=tcount(TaskStatus.IN_REVIEW),
        pending=tcount(TaskStatus.TODO),
        on_hold=tcount(TaskStatus.ON_HOLD),
        overdue=sum(
            1 for t in tasks if t.deadline and t.deadline < today and t.status != TaskStatus.COMPLETED
        ),
        completion_rate=round(len(done) / len(tasks) * 100, 1) if tasks else 0.0,
        on_time_rate=round(on_time / len(done_with_deadline) * 100, 1) if done_with_deadline else 0.0,
        average_progress=average(task_progress),
    )

    # ---- milestones ------------------------------------------------------
    all_ms = db.scalars(select(Milestone).where(Milestone.assigned_to == user.id)).all()
    milestones = [
        m
        for m in all_ms
        if in_range(m.deadline)
        or in_range(to_local_date(m.created_at))
        or (m.status == MilestoneStatus.COMPLETED and in_range(to_local_date(m.updated_at)))
    ]
    ms_done = [m for m in milestones if m.status == MilestoneStatus.COMPLETED]
    ms_metrics = MilestoneMetrics(
        total=len(milestones),
        completed=len(ms_done),
        in_progress=sum(1 for m in milestones if m.status == MilestoneStatus.IN_PROGRESS),
        overdue=sum(
            1
            for m in milestones
            if m.deadline and m.deadline < today and m.status != MilestoneStatus.COMPLETED
        ),
        completion_rate=round(len(ms_done) / len(milestones) * 100, 1) if milestones else 0.0,
        average_progress=average(
            [100 if m.status == MilestoneStatus.COMPLETED else m.progress for m in milestones]
        ),
    )

    # ---- reports ---------------------------------------------------------
    reports = db.scalars(
        select(DailyReport).where(
            DailyReport.employee_id == user.id,
            DailyReport.report_date >= start_date,
            DailyReport.report_date <= end_date,
        )
    ).all()
    official = [r for r in reports if r.status != ReportStatus.DRAFT]
    official_ids = [r.id for r in official]
    entries: list[tuple[date, float, str | None]] = []
    if official_ids:
        rows = db.execute(
            select(
                DailyReport.report_date,
                DailyReportEntry.time_spent_hours,
                Project.name,
            )
            .join(DailyReportEntry, DailyReportEntry.report_id == DailyReport.id)
            .outerjoin(Project, Project.id == DailyReportEntry.project_id)
            .where(DailyReport.id.in_(official_ids))
        ).all()
        entries = [(d, float(h or 0), name) for d, h, name in rows]

    total_hours = round(sum(h for _, h, _ in entries), 1)
    expected = _working_days(start_date, min(end_date, today))
    report_metrics = ReportMetrics(
        expected=expected,
        submitted=len(official),
        approved=sum(1 for r in official if r.status == ReportStatus.APPROVED),
        revision_requested=sum(1 for r in official if r.status == ReportStatus.REVISION_REQUESTED),
        consistency_rate=round(min(len(official) / expected, 1) * 100, 1) if expected else 0.0,
        total_hours=total_hours,
        average_hours_per_day=round(total_hours / len(official), 1) if official else 0.0,
    )

    # ---- trend -----------------------------------------------------------
    completed_by: dict[date, int] = defaultdict(int)
    for t in done:
        d = to_local_date(t.updated_at)
        if in_range(d):
            completed_by[_bucket(d, span)] += 1
    hours_by: dict[date, float] = defaultdict(float)
    for d, h, _ in entries:
        hours_by[_bucket(d, span)] += h

    buckets: list[date] = []
    cursor = start_date
    while cursor <= end_date:
        b = _bucket(cursor, span)
        if not buckets or buckets[-1] != b:
            buckets.append(b)
        cursor += timedelta(days=1)
    trend = [
        TrendPoint(
            date=b,
            tasks_completed=completed_by.get(b, 0),
            hours_logged=round(hours_by.get(b, 0.0), 1),
        )
        for b in buckets
    ]

    # ---- breakdowns ------------------------------------------------------
    priority_breakdown = [
        BreakdownItem(
            key=p.value,
            label=p.value.capitalize(),
            count=sum(1 for t in tasks if t.priority == p),
        )
        for p in (Priority.URGENT, Priority.HIGH, Priority.MEDIUM, Priority.LOW)
    ]
    per_project_hours: dict[str, float] = defaultdict(float)
    per_project_count: dict[str, int] = defaultdict(int)
    for _, h, name in entries:
        label = name or "No project"
        per_project_hours[label] += h
        per_project_count[label] += 1
    work_by_project = [
        BreakdownItem(
            key=label.lower().replace(" ", "_"),
            label=label,
            count=per_project_count[label],
            hours=round(hours, 1),
        )
        for label, hours in sorted(per_project_hours.items(), key=lambda kv: -kv[1])
    ]

    # ---- score -----------------------------------------------------------
    components: list[tuple[float, float]] = []  # (weight, value 0-100)
    if tasks:
        components.append((40, task_metrics.completion_rate))
        if done_with_deadline:
            components.append((20, task_metrics.on_time_rate))
        components.append((10, task_metrics.average_progress))
    if milestones:
        components.append((10, ms_metrics.completion_rate))
    if expected:
        components.append((20, report_metrics.consistency_rate))
    total_weight = sum(w for w, _ in components)
    score = round(sum(w * v for w, v in components) / total_weight, 1) if total_weight else 0.0
    # overdue work drags the score down a little (max -10)
    if components and task_metrics.overdue:
        score = max(0.0, round(score - min(10, task_metrics.overdue * 2), 1))

    return PerformanceResponse(
        period=period,
        start_date=start_date,
        end_date=end_date,
        productivity_score=score,
        rating=_rating(score, bool(components)),
        tasks=task_metrics,
        milestones=ms_metrics,
        reports=report_metrics,
        trend=trend,
        tasks_by_priority=priority_breakdown,
        work_by_project=work_by_project,
    )
