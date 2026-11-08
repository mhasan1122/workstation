from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import enum_type, utcnow
from app.models.enums import Priority, TaskStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[Priority] = mapped_column(enum_type(Priority), default=Priority.MEDIUM)
    status: Mapped[TaskStatus] = mapped_column(
        enum_type(TaskStatus), default=TaskStatus.TODO, index=True
    )
    progress: Mapped[int] = mapped_column(Integer, default=0)
    deadline: Mapped[date | None] = mapped_column(Date, index=True)
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    submitted_for_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    project: Mapped[Project | None] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship(foreign_keys=[assigned_to])
    comments: Mapped[list[TaskComment]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskComment.created_at",
    )
    attachments: Mapped[list[TaskAttachment]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskAttachment.created_at",
    )


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    task: Mapped[Task] = relationship(back_populates="comments")
    user: Mapped[User | None] = relationship()


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    task: Mapped[Task] = relationship(back_populates="attachments")
    user: Mapped[User | None] = relationship()
