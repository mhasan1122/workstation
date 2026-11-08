from datetime import date
from enum import StrEnum

from pydantic import BaseModel


class PerformancePeriod(StrEnum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class TaskMetrics(BaseModel):
    total: int
    completed: int
    in_progress: int
    in_review: int
    pending: int
    on_hold: int
    overdue: int
    completion_rate: float
    on_time_rate: float
    average_progress: float


class MilestoneMetrics(BaseModel):
    total: int
    completed: int
    in_progress: int
    overdue: int
    completion_rate: float
    average_progress: float


class ReportMetrics(BaseModel):
    expected: int  # working days in the period (Mon-Fri, up to today)
    submitted: int
    approved: int
    revision_requested: int
    consistency_rate: float
    total_hours: float
    average_hours_per_day: float


class TrendPoint(BaseModel):
    date: date
    tasks_completed: int
    hours_logged: float


class BreakdownItem(BaseModel):
    key: str
    label: str
    count: int
    hours: float = 0.0


class PerformanceResponse(BaseModel):
    period: PerformancePeriod
    start_date: date
    end_date: date
    productivity_score: float  # 0-100
    rating: str
    tasks: TaskMetrics
    milestones: MilestoneMetrics
    reports: ReportMetrics
    trend: list[TrendPoint]
    tasks_by_priority: list[BreakdownItem]
    work_by_project: list[BreakdownItem]
