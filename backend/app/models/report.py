from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import enum_type, utcnow
from app.models.enums import ReportStatus, WorkStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.task import Task
    from app.models.user import User


class DailyReport(Base):
    __tablename__ = "daily_reports"
    __table_args__ = (UniqueConstraint("employee_id", "report_date", name="uq_report_employee_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # FK to users.id (the employee who owns the report)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    report_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[ReportStatus] = mapped_column(
        enum_type(ReportStatus), default=ReportStatus.DRAFT, index=True
    )
    admin_feedback: Mapped[str | None] = mapped_column(Text)
    # Employee's reply when responding to a revision request
    employee_response: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    employee: Mapped[User] = relationship()
    entries: Mapped[list[DailyReportEntry]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="DailyReportEntry.id",
    )
    attachments: Mapped[list[DailyReportAttachment]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="DailyReportAttachment.id",
    )


class DailyReportEntry(Base):
    __tablename__ = "daily_report_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("daily_reports.id", ondelete="CASCADE"), index=True
    )
    task_title: Mapped[str] = mapped_column(String(255))
    work_description: Mapped[str] = mapped_column(Text)
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    # Kept after project delete so historical reports still show the project name.
    project_name: Mapped[str | None] = mapped_column(String(200))
    related_task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL")
    )
    time_spent_hours: Mapped[float] = mapped_column(Float, default=0.0)
    work_status: Mapped[WorkStatus] = mapped_column(
        enum_type(WorkStatus), default=WorkStatus.IN_PROGRESS
    )
    achievement: Mapped[str | None] = mapped_column(Text)
    challenges: Mapped[str | None] = mapped_column(Text)
    next_day_plan: Mapped[str | None] = mapped_column(Text)

    report: Mapped[DailyReport] = relationship(back_populates="entries")
    project: Mapped[Project | None] = relationship()
    related_task: Mapped[Task | None] = relationship()


class DailyReportAttachment(Base):
    __tablename__ = "daily_report_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("daily_reports.id", ondelete="CASCADE"), index=True
    )
    entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("daily_report_entries.id", ondelete="CASCADE")
    )
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))

    report: Mapped[DailyReport] = relationship(back_populates="attachments")
