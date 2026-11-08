from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field

from app.models.enums import MilestoneStatus, Priority
from app.schemas.common import AttachmentOut, CommentOut, ORMModel
from app.schemas.task import ProjectRef


class MilestoneOut(ORMModel):
    id: int
    title: str
    description: str | None = None
    deadline: date | None = None
    priority: Priority
    progress: int
    status: MilestoneStatus
    project_id: int | None = None
    project: ProjectRef | None = None
    assigned_to: int | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_personal(self) -> bool:
        return self.project_id is None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_overdue(self) -> bool:
        return bool(
            self.deadline
            and self.deadline < date.today()
            and self.status != MilestoneStatus.COMPLETED
        )


class MilestoneDetail(MilestoneOut):
    comments: list[CommentOut] = []
    attachments: list[AttachmentOut] = []


class MilestoneUpdate(BaseModel):
    """Employees may update progress (and move between pending / in_progress)."""

    progress: int | None = Field(default=None, ge=0, le=100)
    status: MilestoneStatus | None = None
