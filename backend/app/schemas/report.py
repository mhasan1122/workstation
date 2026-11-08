from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field, field_validator

from app.models.enums import ReportStatus, WorkStatus
from app.schemas.common import ORMModel
from app.services.files import file_url


class EntryBase(BaseModel):
    task_title: str = Field(min_length=1, max_length=255)
    work_description: str = Field(min_length=1, max_length=10000)
    project_id: int | None = None
    related_task_id: int | None = None
    time_spent_hours: float = Field(default=0.0, ge=0, le=24)
    work_status: WorkStatus = WorkStatus.IN_PROGRESS
    achievement: str | None = Field(default=None, max_length=5000)
    challenges: str | None = Field(default=None, max_length=5000)
    next_day_plan: str | None = Field(default=None, max_length=5000)

    @field_validator("task_title", "work_description")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class ReportEntryCreate(EntryBase):
    pass


class ReportEntryUpdate(BaseModel):
    task_title: str | None = Field(default=None, min_length=1, max_length=255)
    work_description: str | None = Field(default=None, min_length=1, max_length=10000)
    project_id: int | None = None
    related_task_id: int | None = None
    time_spent_hours: float | None = Field(default=None, ge=0, le=24)
    work_status: WorkStatus | None = None
    achievement: str | None = Field(default=None, max_length=5000)
    challenges: str | None = Field(default=None, max_length=5000)
    next_day_plan: str | None = Field(default=None, max_length=5000)


class ReportCreate(BaseModel):
    report_date: date = Field(default_factory=date.today)
    entries: list[ReportEntryCreate] = []


class ReportSave(BaseModel):
    """Save draft: optionally change the date and/or replace all entries."""

    report_date: date | None = None
    entries: list[ReportEntryCreate] | None = None


class RevisionResponse(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    entries: list[ReportEntryCreate] | None = None


class ProjectBrief(ORMModel):
    id: int
    name: str


class TaskBrief(ORMModel):
    id: int
    title: str


class ReportEntryOut(ORMModel):
    id: int
    report_id: int
    task_title: str
    work_description: str
    project_id: int | None = None
    project_name: str | None = None
    project: ProjectBrief | None = None
    related_task_id: int | None = None
    related_task: TaskBrief | None = None
    time_spent_hours: float
    work_status: WorkStatus
    achievement: str | None = None
    challenges: str | None = None
    next_day_plan: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def project_label(self) -> str | None:
        if self.project is not None:
            return self.project.name
        return self.project_name


class ReportAttachmentOut(ORMModel):
    id: int
    report_id: int
    entry_id: int | None = None
    filename: str
    file_path: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str | None:
        return file_url(self.file_path)


class ReportOut(ORMModel):
    id: int
    employee_id: int
    report_date: date
    status: ReportStatus
    admin_feedback: str | None = None
    employee_response: str | None = None
    submitted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    entries: list[ReportEntryOut] = []
    attachments: list[ReportAttachmentOut] = []

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_hours(self) -> float:
        return round(sum(e.time_spent_hours for e in self.entries), 2)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def entry_count(self) -> int:
        return len(self.entries)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_editable(self) -> bool:
        return self.status in (ReportStatus.DRAFT, ReportStatus.REVISION_REQUESTED)


class ReportList(BaseModel):
    items: list[ReportOut]
    total: int
    limit: int
    offset: int
