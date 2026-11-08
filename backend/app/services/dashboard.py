from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import MilestoneStatus, Priority, ProjectStatus, ReportStatus, TaskStatus
from app.models.milestone import Milestone
from app.models.notification import ActivityLog, Notification
from app.models.project import Project
from app.models.report import DailyReport, DailyReportEntry
from app.models.task import Task
from app.models.user import User
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardStats,
    FeedbackItem,
    MonthlyProductivity,
    ProjectProgressItem,
    UpcomingDeadline,
)
from app.schemas.notification import ActivityOut
from app.schemas.report import ReportOut
from app.schemas.task import TaskOut
from app.services.access import my_project_ids_query, report_query
from app.services.progress import average, to_local_date

PRIORITY_ORDER = {
    Priority.URGENT: 0,
    Priority.HIGH: 1,
    Priority.MEDIUM: 2,
    Priority.LOW: 3,
}


def _month_start(d: date, offset: int = 0) -> date:
    """First day of the month `offset` months from d's month (offset may be negative)."""
    index = d.year * 12 + (d.month - 1) + offset
    return date(index // 12, index % 12 + 1, 1)


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _monthly_productivity(
    db: Session, user: User, tasks: list[Task], today: date
) -> list[MonthlyProductivity]:
    months = [_month_start(today, -i) for i in range(5, -1, -1)]
    result: list[MonthlyProductivity] = []

    first = months[0]
    reports = db.execute(
        select(DailyReport.id, DailyReport.report_date, DailyReport.status).where(
            DailyReport.employee_id == user.id, DailyReport.report_date >= first
        )
    ).all()
    hours_rows = db.execute(
        select(DailyReport.report_date, func.coalesce(func.sum(DailyReportEntry.time_spent_hours), 0))
        .join(DailyReportEntry, DailyReportEntry.report_id == DailyReport.id)
        .where(DailyReport.employee_id == user.id, DailyReport.report_date >= first)
        .group_by(DailyReport.report_date)
    ).all()

    for start in months:
        end = _month_start(start, 1)
        completed = sum(
            1
            for t in tasks
            if t.status == TaskStatus.COMPLETED and start <= to_local_date(t.updated_at) < end
        )
        assigned = sum(1 for t in tasks if start <= to_local_date(t.created_at) < end)
        submitted = sum(
            1 for r in reports if start <= r.report_date < end and r.status != ReportStatus.DRAFT
        )
        hours = sum(float(h) for d, h in hours_rows if start <= d < end)
        result.append(
            MonthlyProductivity(
                month=start.strftime("%Y-%m"),
                label=start.strftime("%b %Y"),
                tasks_completed=completed,
                tasks_assigned=assigned,
                reports_submitted=submitted,
                hours_logged=round(hours, 1),
            )
        )
    return result


def build_dashboard(db: Session, user: User) -> DashboardResponse:
    today = date.today()

    tasks = list(
        db.scalars(
            select(Task).where(Task.assigned_to == user.id).options(selectinload(Task.project))
        )
    )
    milestones = list(
        db.scalars(
            select(Milestone)
            .where(Milestone.assigned_to == user.id)
            .options(selectinload(Milestone.project))
        )
    )
    projects = list(
        db.scalars(
            select(Project)
            .where(Project.id.in_(my_project_ids_query(user)))
            .order_by(Project.deadline.asc().nulls_last(), Project.id)
        )
    )

    # --- stats -------------------------------------------------------------
    def count_status(status: TaskStatus) -> int:
        return sum(1 for t in tasks if t.status == status)

    completed = count_status(TaskStatus.COMPLETED)
    overdue = sum(
        1 for t in tasks if t.deadline and t.deadline < today and t.status != TaskStatus.COMPLETED
    )

    month_start = _month_start(today)
    reports_this_month = (
        db.scalar(
            select(func.count())
            .select_from(DailyReport)
            .where(
                DailyReport.employee_id == user.id,
                DailyReport.report_date >= month_start,
                DailyReport.status != ReportStatus.DRAFT,
            )
        )
        or 0
    )
    today_submitted = db.scalar(
        select(func.count())
        .select_from(DailyReport)
        .where(
            DailyReport.employee_id == user.id,
            DailyReport.report_date == today,
            DailyReport.status != ReportStatus.DRAFT,
        )
    )
    hours_week = db.scalar(
        select(func.coalesce(func.sum(DailyReportEntry.time_spent_hours), 0))
        .join(DailyReport, DailyReport.id == DailyReportEntry.report_id)
        .where(
            DailyReport.employee_id == user.id,
            DailyReport.report_date >= week_start(today),
            DailyReport.report_date <= today,
        )
    )

    stats = DashboardStats(
        total_tasks=len(tasks),
        completed_tasks=completed,
        in_progress_tasks=count_status(TaskStatus.IN_PROGRESS),
        pending_tasks=count_status(TaskStatus.TODO),
        in_review_tasks=count_status(TaskStatus.IN_REVIEW),
        on_hold_tasks=count_status(TaskStatus.ON_HOLD),
        overdue_tasks=overdue,
        completion_rate=round(completed / len(tasks) * 100, 1) if tasks else 0.0,
        average_task_progress=average(
            [100 if t.status == TaskStatus.COMPLETED else t.progress for t in tasks]
        ),
        total_projects=len(projects),
        active_projects=sum(1 for p in projects if p.status == ProjectStatus.ACTIVE),
        total_milestones=len(milestones),
        completed_milestones=sum(1 for m in milestones if m.status == MilestoneStatus.COMPLETED),
        reports_this_month=reports_this_month,
        pending_reports_today=(today.weekday() < 5 and not today_submitted),
        hours_this_week=round(float(hours_week or 0), 1),
    )

    # --- today's tasks -----------------------------------------------------
    todays = [
        t
        for t in tasks
        if t.status not in (TaskStatus.COMPLETED, TaskStatus.IN_REVIEW)
        and (t.deadline == today or t.status == TaskStatus.IN_PROGRESS)
    ]
    todays.sort(key=lambda t: (PRIORITY_ORDER[t.priority], t.deadline or date.max))

    # --- upcoming deadlines ------------------------------------------------
    horizon = today + timedelta(days=14)
    upcoming: list[UpcomingDeadline] = []
    for t in tasks:
        if t.deadline and today <= t.deadline <= horizon and t.status != TaskStatus.COMPLETED:
            upcoming.append(
                UpcomingDeadline(
                    type="task",
                    id=t.id,
                    title=t.title,
                    deadline=t.deadline,
                    days_left=(t.deadline - today).days,
                    priority=t.priority,
                    progress=t.progress,
                    project_name=t.project.name if t.project else None,
                )
            )
    for m in milestones:
        if m.deadline and today <= m.deadline <= horizon and m.status != MilestoneStatus.COMPLETED:
            upcoming.append(
                UpcomingDeadline(
                    type="milestone",
                    id=m.id,
                    title=m.title,
                    deadline=m.deadline,
                    days_left=(m.deadline - today).days,
                    priority=m.priority,
                    progress=m.progress,
                    project_name=m.project.name if m.project else None,
                )
            )
    upcoming.sort(key=lambda u: (u.deadline, PRIORITY_ORDER[u.priority]))

    # --- activities --------------------------------------------------------
    activities = db.scalars(
        select(ActivityLog)
        .where(ActivityLog.user_id == user.id)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
        .limit(10)
    ).all()

    # --- project progress --------------------------------------------------
    project_progress: list[ProjectProgressItem] = []
    for p in projects:
        mine = [t for t in tasks if t.project_id == p.id]
        done = sum(1 for t in mine if t.status == TaskStatus.COMPLETED)
        my_progress = average([100 if t.status == TaskStatus.COMPLETED else t.progress for t in mine])
        project_progress.append(
            ProjectProgressItem(
                id=p.id,
                name=p.name,
                status=p.status.value,
                deadline=p.deadline,
                overall_progress=p.overall_progress,
                my_progress=round(my_progress),
                my_tasks_total=len(mine),
                my_tasks_completed=done,
            )
        )

    # --- reports & feedback ------------------------------------------------
    recent_reports = db.scalars(
        report_query(user).order_by(DailyReport.report_date.desc()).limit(5)
    ).all()
    feedback_rows = db.scalars(
        select(DailyReport)
        .where(DailyReport.employee_id == user.id, DailyReport.admin_feedback.is_not(None))
        .order_by(DailyReport.updated_at.desc())
        .limit(5)
    ).all()
    recent_feedback = [
        FeedbackItem(
            report_id=r.id,
            report_date=r.report_date,
            status=r.status.value,
            feedback=r.admin_feedback or "",
        )
        for r in feedback_rows
        if r.admin_feedback
    ]

    unread = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        )
        or 0
    )

    return DashboardResponse(
        stats=stats,
        todays_tasks=[TaskOut.model_validate(t) for t in todays[:10]],
        upcoming_deadlines=upcoming[:8],
        recent_activities=[ActivityOut.model_validate(a) for a in activities],
        project_progress=project_progress,
        monthly_productivity=_monthly_productivity(db, user, tasks, today),
        recent_reports=[ReportOut.model_validate(r) for r in recent_reports],
        recent_feedback=recent_feedback,
        unread_notifications=unread,
    )

