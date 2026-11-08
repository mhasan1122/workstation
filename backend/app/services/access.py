"""Ownership helpers. Employees may only ever load their own records; anything
else returns 404 (not 403) so IDs of other users' records are not revealed."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.milestone import Milestone
from app.models.project import Project, ProjectMember
from app.models.report import DailyReport, DailyReportEntry
from app.models.task import Task
from app.models.user import User


def _not_found(what: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def get_my_task(db: Session, user: User, task_id: int, *, detail: bool = False) -> Task:
    stmt = select(Task).where(Task.id == task_id, Task.assigned_to == user.id)
    stmt = stmt.options(selectinload(Task.project))
    if detail:
        stmt = stmt.options(selectinload(Task.comments), selectinload(Task.attachments))
    task = db.scalars(stmt).first()
    if task is None:
        raise _not_found("Task")
    return task


def get_my_milestone(db: Session, user: User, milestone_id: int, *, detail: bool = False) -> Milestone:
    stmt = select(Milestone).where(Milestone.id == milestone_id, Milestone.assigned_to == user.id)
    stmt = stmt.options(selectinload(Milestone.project))
    if detail:
        stmt = stmt.options(
            selectinload(Milestone.comments), selectinload(Milestone.attachments)
        )
    milestone = db.scalars(stmt).first()
    if milestone is None:
        raise _not_found("Milestone")
    return milestone


def my_project_ids_query(user: User):  # noqa: ANN201
    """Subquery of project ids the user belongs to (member, or has tasks / milestones)."""
    member = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
    task = select(Task.project_id).where(Task.assigned_to == user.id, Task.project_id.is_not(None))
    ms = select(Milestone.project_id).where(
        Milestone.assigned_to == user.id, Milestone.project_id.is_not(None)
    )
    return member.union(task, ms)


def user_can_access_project(db: Session, user: User, project_id: int) -> bool:
    stmt = select(Project.id).where(
        Project.id == project_id, Project.id.in_(my_project_ids_query(user))
    )
    return db.scalar(stmt) is not None


def get_my_project(db: Session, user: User, project_id: int) -> Project:
    project = db.scalars(
        select(Project)
        .where(Project.id == project_id, Project.id.in_(my_project_ids_query(user)))
        .options(selectinload(Project.members).selectinload(ProjectMember.user))
    ).first()
    if project is None:
        raise _not_found("Project")
    return project


def report_query(user: User):  # noqa: ANN201
    return (
        select(DailyReport)
        .where(DailyReport.employee_id == user.id)
        .options(
            selectinload(DailyReport.entries).selectinload(DailyReportEntry.project),
            selectinload(DailyReport.entries).selectinload(DailyReportEntry.related_task),
            selectinload(DailyReport.attachments),
        )
    )


def get_my_report(db: Session, user: User, report_id: int) -> DailyReport:
    report = db.scalars(report_query(user).where(DailyReport.id == report_id)).first()
    if report is None:
        raise _not_found("Report")
    return report


__all__ = [
    "get_my_milestone",
    "get_my_project",
    "get_my_report",
    "get_my_task",
    "my_project_ids_query",
    "report_query",
    "user_can_access_project",
]
