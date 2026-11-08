from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ProjectStatus
from app.schemas.common import ORMModel, UserBrief
from app.schemas.milestone import MilestoneOut
from app.schemas.task import TaskOut


class ProjectCreate(BaseModel):
    """Employee-created project; creator becomes a member automatically."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_date: date | None = None
    deadline: date | None = None
    status: ProjectStatus = ProjectStatus.PLANNING

    @model_validator(mode="after")
    def _dates_ok(self) -> "ProjectCreate":
        if self.start_date and self.deadline and self.deadline < self.start_date:
            raise ValueError("Deadline cannot be before start date")
        return self


class ProjectUpdate(BaseModel):
    """Employee may update project fields for projects they belong to."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_date: date | None = None
    deadline: date | None = None
    clear_start_date: bool = False
    clear_deadline: bool = False
    status: ProjectStatus | None = None

    @model_validator(mode="after")
    def _dates_ok(self) -> "ProjectUpdate":
        start = None if self.clear_start_date else self.start_date
        end = None if self.clear_deadline else self.deadline
        if start and end and end < start:
            raise ValueError("Deadline cannot be before start date")
        return self


class ProjectOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    start_date: date | None = None
    deadline: date | None = None
    status: ProjectStatus
    overall_progress: int
    created_by: int | None = None
    created_at: datetime


class ProjectListItem(ProjectOut):
    member_count: int = 0
    my_tasks_total: int = 0
    my_tasks_completed: int = 0
    my_progress: int = 0


class ProjectDetail(ProjectOut):
    members: list[UserBrief] = []
    my_tasks: list[TaskOut] = []
    my_milestones: list[MilestoneOut] = []
    my_tasks_total: int = 0
    my_tasks_completed: int = 0
    my_progress: int = 0
