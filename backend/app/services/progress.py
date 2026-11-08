from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import TaskStatus
from app.models.project import Project
from app.models.task import Task


def recalc_project_progress(db: Session, project_id: int | None) -> None:
    """Overall project progress = mean progress across its tasks
    (completed tasks always count as 100). Caller commits."""
    if project_id is None:
        return
    project = db.get(Project, project_id)
    if project is None:
        return
    rows = db.execute(
        select(Task.status, Task.progress).where(Task.project_id == project_id)
    ).all()
    if not rows:
        return
    values = [100 if status == TaskStatus.COMPLETED else progress for status, progress in rows]
    project.overall_progress = round(sum(values) / len(values))


def average(values: list[int] | list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def to_local_date(value: datetime) -> date:
    """Convert a (possibly timezone-aware) datetime to a local calendar date."""
    if value.tzinfo is not None:
        value = value.astimezone()
    return value.date()
