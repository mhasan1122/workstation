from datetime import date

from pydantic import BaseModel

from app.models.enums import Priority
from app.schemas.notification import ActivityOut
from app.schemas.report import ReportOut
from app.schemas.task import TaskOut


class DashboardStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    pending_tasks: int  # todo
    in_review_tasks: int
    on_hold_tasks: int
    overdue_tasks: int
    completion_rate: float
    average_task_progress: float
    total_projects: int
    active_projects: int
    total_milestones: int
    completed_milestones: int
    reports_this_month: int
    pending_reports_today: bool
    hours_this_week: float


class UpcomingDeadline(BaseModel):
    type: str  # task | milestone
    id: int
    title: str
    deadline: date
    days_left: int
    priority: Priority
    progress: int
    project_name: str | None = None


class ProjectProgressItem(BaseModel):
    id: int
    name: str
    status: str
    deadline: date | None = None
    overall_progress: int
    my_progress: int
    my_tasks_total: int
    my_tasks_completed: int


class MonthlyProductivity(BaseModel):
    month: str  # YYYY-MM
    label: str  # e.g. "Jun 2026"
    tasks_completed: int
    tasks_assigned: int
    reports_submitted: int
    hours_logged: float


class FeedbackItem(BaseModel):
    report_id: int
    report_date: date
    status: str
    feedback: str


class DashboardResponse(BaseModel):
    stats: DashboardStats
    todays_tasks: list[TaskOut]
    upcoming_deadlines: list[UpcomingDeadline]
    recent_activities: list[ActivityOut]
    project_progress: list[ProjectProgressItem]
    monthly_productivity: list[MonthlyProductivity]
    recent_reports: list[ReportOut]
    recent_feedback: list[FeedbackItem]
    unread_notifications: int
