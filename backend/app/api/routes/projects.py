from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, text, update
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentEmployee, DbSession
from app.models.enums import NotificationType, ProjectStatus, TaskStatus
from app.models.milestone import Milestone
from app.models.project import Project, ProjectMember
from app.models.task import Task
from app.schemas.common import UserBrief
from app.schemas.milestone import MilestoneOut
from app.schemas.project import (
    ProjectCreate,
    ProjectDetail,
    ProjectListItem,
    ProjectOut,
    ProjectUpdate,
)
from app.schemas.task import TaskOut
from app.services.access import get_my_project, my_project_ids_query
from app.services.activity import log_activity, notify_admins
from app.services.progress import average

router = APIRouter(prefix="/projects", tags=["projects"])


def _my_progress(tasks: list[Task]) -> tuple[int, int, int]:
    done = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    progress = average([100 if t.status == TaskStatus.COMPLETED else t.progress for t in tasks])
    return len(tasks), done, round(progress)


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, user: CurrentEmployee, db: DbSession) -> ProjectDetail:
    project = Project(
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        start_date=payload.start_date,
        deadline=payload.deadline,
        status=payload.status,
        overall_progress=0,
        created_by=user.id,
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=user.id))
    log_activity(
        db,
        user.id,
        "project_created",
        "project",
        project.id,
        description=f"Created project '{project.name}'",
        title=project.name,
    )
    notify_admins(
        db,
        title="New project created",
        message=f"{user.full_name} created project '{project.name}'.",
        type=NotificationType.PROJECT,
        link=f"/admin/projects/{project.id}",
    )
    db.commit()
    return get_project(project.id, user, db)


@router.get("", response_model=list[ProjectListItem])
def list_my_projects(
    user: CurrentEmployee,
    db: DbSession,
    status_filter: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> list[ProjectListItem]:
    stmt = (
        select(Project)
        .where(Project.id.in_(my_project_ids_query(user)))
        .options(selectinload(Project.members))
    )
    if status_filter is not None:
        stmt = stmt.where(Project.status == status_filter)
    if search:
        stmt = stmt.where(Project.name.ilike(f"%{search.strip()}%"))
    stmt = stmt.order_by(Project.deadline.asc().nulls_last(), Project.id)
    projects = list(db.scalars(stmt))

    my_tasks = db.scalars(
        select(Task).where(
            Task.assigned_to == user.id, Task.project_id.in_([p.id for p in projects])
        )
    ).all()
    by_project: dict[int, list[Task]] = {}
    for t in my_tasks:
        by_project.setdefault(t.project_id, []).append(t)  # type: ignore[arg-type]

    items: list[ProjectListItem] = []
    for p in projects:
        total, done, progress = _my_progress(by_project.get(p.id, []))
        item = ProjectListItem.model_validate(p)
        item.member_count = len(p.members)
        item.my_tasks_total = total
        item.my_tasks_completed = done
        item.my_progress = progress
        items.append(item)
    return items


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, user: CurrentEmployee, db: DbSession) -> ProjectDetail:
    project = get_my_project(db, user, project_id)

    tasks = list(
        db.scalars(
            select(Task)
            .where(Task.project_id == project.id, Task.assigned_to == user.id)
            .options(selectinload(Task.project))
            .order_by(Task.deadline.asc().nulls_last(), Task.id)
        )
    )
    milestones = list(
        db.scalars(
            select(Milestone)
            .where(Milestone.project_id == project.id, Milestone.assigned_to == user.id)
            .options(selectinload(Milestone.project))
            .order_by(Milestone.deadline.asc().nulls_last(), Milestone.id)
        )
    )
    total, done, progress = _my_progress(tasks)
    members = [
        UserBrief.model_validate(m.user)
        for m in sorted(project.members, key=lambda m: m.user.full_name)
        if m.user.is_active
    ]
    detail = ProjectDetail(
        **ProjectOut.model_validate(project).model_dump(),
        members=members,
        my_tasks=[TaskOut.model_validate(t) for t in tasks],
        my_milestones=[MilestoneOut.model_validate(m) for m in milestones],
        my_tasks_total=total,
        my_tasks_completed=done,
        my_progress=progress,
    )
    return detail


@router.patch("/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: int, payload: ProjectUpdate, user: CurrentEmployee, db: DbSession
) -> ProjectDetail:
    project = get_my_project(db, user, project_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    changes: list[str] = []
    if "name" in data and payload.name is not None:
        name = payload.name.strip()
        if name != project.name:
            changes.append(f"name → '{name}'")
            project.name = name
    if "description" in data:
        desc = (payload.description or "").strip() or None
        if desc != project.description:
            changes.append("description updated")
            project.description = desc
    if payload.clear_start_date:
        if project.start_date is not None:
            changes.append("start date cleared")
            project.start_date = None
    elif "start_date" in data and payload.start_date != project.start_date:
        changes.append(
            f"start date → {payload.start_date.isoformat() if payload.start_date else 'none'}"
        )
        project.start_date = payload.start_date
    if payload.clear_deadline:
        if project.deadline is not None:
            changes.append("deadline cleared")
            project.deadline = None
    elif "deadline" in data and payload.deadline != project.deadline:
        changes.append(
            f"deadline → {payload.deadline.isoformat() if payload.deadline else 'none'}"
        )
        project.deadline = payload.deadline
    if payload.status is not None and payload.status != project.status:
        changes.append(f"status {project.status.value} → {payload.status.value}")
        project.status = payload.status

    if project.start_date and project.deadline and project.deadline < project.start_date:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Deadline cannot be before start date"
        )

    if changes:
        log_activity(
            db,
            user.id,
            "project_updated",
            "project",
            project.id,
            description=f"Updated project '{project.name}': {', '.join(changes)}",
            title=project.name,
        )
        notify_admins(
            db,
            title="Project updated",
            message=f"{user.full_name} updated project '{project.name}'.",
            type=NotificationType.PROJECT,
            link=f"/admin/projects/{project.id}",
        )
    db.commit()
    return get_project(project.id, user, db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, user: CurrentEmployee, db: DbSession) -> None:
    project = get_my_project(db, user, project_id)
    name = project.name

    # Detach related rows — never delete reports, tasks, or milestones with the project.
    db.execute(
        text(
            """
            UPDATE daily_report_entries
            SET project_name = COALESCE(NULLIF(project_name, ''), :pname),
                project_id = NULL
            WHERE project_id = :pid
            """
        ),
        {"pname": name, "pid": project.id},
    )
    db.execute(update(Task).where(Task.project_id == project.id).values(project_id=None))
    db.execute(
        update(Milestone).where(Milestone.project_id == project.id).values(project_id=None)
    )
    # Avoid ORM loading task/milestone collections and cascading deletes.
    db.execute(text("DELETE FROM project_members WHERE project_id = :pid"), {"pid": project.id})
    db.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project.id})

    log_activity(
        db,
        user.id,
        "project_deleted",
        "project",
        project_id,
        description=f"Deleted project '{name}' (reports/tasks kept)",
        title=name,
    )
    notify_admins(
        db,
        title="Project deleted",
        message=f"{user.full_name} deleted project '{name}'. Reports and tasks were kept.",
        type=NotificationType.PROJECT,
        link="/admin/projects",
    )
    db.commit()

