from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import enum_type, utcnow
from app.models.enums import ProjectStatus

if TYPE_CHECKING:
    from app.models.milestone import Milestone
    from app.models.task import Task
    from app.models.user import User


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[ProjectStatus] = mapped_column(
        enum_type(ProjectStatus), default=ProjectStatus.PLANNING, index=True
    )
    overall_progress: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    members: Mapped[list[ProjectMember]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    # Never cascade-delete tasks/milestones/reports when a project is removed.
    tasks: Mapped[list[Task]] = relationship(back_populates="project", passive_deletes=True)
    milestones: Mapped[list[Milestone]] = relationship(
        back_populates="project", passive_deletes=True
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship()
