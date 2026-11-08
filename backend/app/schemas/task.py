from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field

from app.models.enums import Priority, TaskStatus
from app.schemas.common import AttachmentOut, CommentOut, ORMModel


class ProjectRef(ORMModel):
    id: int
    name: str


class TaskOut(ORMModel):
    id: int
    title: str
    description: str | None = None
    priority: Priority
    status: TaskStatus
    progress: int
    deadline: date | None = None
    project_id: int | None = None
    project: ProjectRef | None = None
    assigned_to: int | None = None
    created_by: int | None = None
    submitted_for_review_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_overdue(self) -> bool:
        return bool(
            self.deadline
            and self.deadline < date.today()
            and self.status != TaskStatus.COMPLETED
        )


class TaskDetail(TaskOut):
    comments: list[CommentOut] = []
    attachments: list[AttachmentOut] = []


class TaskCreate(BaseModel):
    """Employee-created personal or project-linked task (auto-assigned to self)."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    priority: Priority = Priority.MEDIUM
    deadline: date | None = None
    project_id: int | None = None
    status: TaskStatus = TaskStatus.TODO


class TaskUpdate(BaseModel):
    """Employees may update task fields, status, and progress."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    priority: Priority | None = None
    deadline: date | None = None
    project_id: int | None = None
    clear_project: bool = False
    clear_deadline: bool = False
    status: TaskStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
