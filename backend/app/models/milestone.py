from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import enum_type, utcnow
from app.models.enums import MilestoneStatus, Priority

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[date | None] = mapped_column(Date, index=True)
    priority: Mapped[Priority] = mapped_column(enum_type(Priority), default=Priority.MEDIUM)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[MilestoneStatus] = mapped_column(
        enum_type(MilestoneStatus), default=MilestoneStatus.PENDING, index=True
    )
    # NULL project_id => personal milestone
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    project: Mapped[Project | None] = relationship(back_populates="milestones")
    assignee: Mapped[User | None] = relationship(foreign_keys=[assigned_to])
    comments: Mapped[list[MilestoneComment]] = relationship(
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="MilestoneComment.created_at",
    )
    attachments: Mapped[list[MilestoneAttachment]] = relationship(
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="MilestoneAttachment.created_at",
    )


class MilestoneComment(Base):
    __tablename__ = "milestone_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    milestone_id: Mapped[int] = mapped_column(
        ForeignKey("milestones.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    milestone: Mapped[Milestone] = relationship(back_populates="comments")
    user: Mapped[User | None] = relationship()


class MilestoneAttachment(Base):
    __tablename__ = "milestone_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    milestone_id: Mapped[int] = mapped_column(
        ForeignKey("milestones.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    milestone: Mapped[Milestone] = relationship(back_populates="attachments")
    user: Mapped[User | None] = relationship()
