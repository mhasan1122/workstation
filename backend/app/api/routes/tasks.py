from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import case, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentEmployee, DbSession
from app.models.base import utcnow
from app.models.enums import NotificationType, Priority, TaskStatus
from app.models.task import Task, TaskAttachment, TaskComment
from app.schemas.common import AttachmentOut, CommentCreate, CommentOut
from app.schemas.task import TaskCreate, TaskDetail, TaskOut, TaskUpdate
from app.services.access import get_my_task, user_can_access_project
from app.services.activity import log_activity, notify_admins
from app.services.files import save_upload
from app.services.progress import recalc_project_progress

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Statuses an employee may set directly. in_review still goes through /submit-review.
EMPLOYEE_SETTABLE = {
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.ON_HOLD,
    TaskStatus.COMPLETED,
}
CREATE_SETTABLE = {TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.ON_HOLD}
# Submit-for-review is paused in the UI; nothing is locked so employees can still edit/delete.
LOCKED: set[TaskStatus] = set()


def _ensure_not_locked(task: Task) -> None:
    if task.status in LOCKED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Task is '{task.status.value}' and cannot be modified",
        )


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentEmployee, db: DbSession) -> Task:
    if payload.project_id is not None and not user_can_access_project(db, user, payload.project_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
    if payload.status not in CREATE_SETTABLE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Initial status must be todo, in_progress or on_hold",
        )

    task = Task(
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        priority=payload.priority,
        status=payload.status,
        progress=0,
        deadline=payload.deadline,
        project_id=payload.project_id,
        assigned_to=user.id,
        created_by=user.id,
    )
    db.add(task)
    db.flush()
    log_activity(
        db,
        user.id,
        "task_created",
        "task",
        task.id,
        description=f"Created task '{task.title}'",
        title=task.title,
    )
    notify_admins(
        db,
        title="New task created",
        message=f"{user.full_name} created task '{task.title}'.",
        type=NotificationType.TASK,
        link=f"/admin/tasks/{task.id}",
    )
    if task.project_id:
        recalc_project_progress(db, task.project_id)
    db.commit()
    db.refresh(task)
    return get_my_task(db, user, task.id)


@router.get("", response_model=list[TaskOut])
def list_tasks(
    user: CurrentEmployee,
    db: DbSession,
    status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
    project_id: int | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    overdue: bool | None = None,
    deadline: date | None = None,
    deadline_from: date | None = None,
    deadline_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Task]:
    stmt = (
        select(Task)
        .where(Task.assigned_to == user.id)
        .options(selectinload(Task.project))
    )
    if status_filter is not None:
        stmt = stmt.where(Task.status == status_filter)
    if priority is not None:
        stmt = stmt.where(Task.priority == priority)
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if search:
        stmt = stmt.where(Task.title.ilike(f"%{search.strip()}%"))
    if overdue:
        stmt = stmt.where(Task.deadline < date.today(), Task.status != TaskStatus.COMPLETED)
    if deadline is not None:
        stmt = stmt.where(Task.deadline == deadline)
    if deadline_from is not None:
        stmt = stmt.where(Task.deadline >= deadline_from)
    if deadline_to is not None:
        stmt = stmt.where(Task.deadline <= deadline_to)

    priority_rank = case(
        (Task.priority == Priority.URGENT, 0),
        (Task.priority == Priority.HIGH, 1),
        (Task.priority == Priority.MEDIUM, 2),
        else_=3,
    )
    stmt = (
        stmt.order_by(Task.deadline.asc().nulls_last(), priority_rank, Task.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, user: CurrentEmployee, db: DbSession) -> Task:
    return get_my_task(db, user, task_id, detail=True)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, user: CurrentEmployee, db: DbSession) -> Task:
    task = get_my_task(db, user, task_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    _ensure_not_locked(task)

    old_status, old_progress = task.status, task.progress
    old_project_id = task.project_id
    changes: list[str] = []

    if "title" in data and payload.title is not None:
        title = payload.title.strip()
        if title != task.title:
            changes.append(f"title → '{title}'")
            task.title = title
    if "description" in data:
        desc = (payload.description or "").strip() or None
        if desc != task.description:
            changes.append("description updated")
            task.description = desc
    if payload.priority is not None and payload.priority != task.priority:
        changes.append(f"priority {task.priority.value} → {payload.priority.value}")
        task.priority = payload.priority
    if payload.clear_deadline:
        if task.deadline is not None:
            changes.append("deadline cleared")
            task.deadline = None
    elif "deadline" in data and payload.deadline != task.deadline:
        changes.append(f"deadline → {payload.deadline.isoformat() if payload.deadline else 'none'}")
        task.deadline = payload.deadline

    if payload.clear_project:
        if task.project_id is not None:
            changes.append("project cleared")
            task.project_id = None
    elif "project_id" in data:
        new_project_id = payload.project_id
        if new_project_id is not None and not user_can_access_project(db, user, new_project_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
        if new_project_id != task.project_id:
            changes.append("project updated")
            task.project_id = new_project_id

    if payload.status is not None:
        if payload.status not in EMPLOYEE_SETTABLE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Status can only be set to todo, in_progress, on_hold or completed. "
                    "Use /submit-review to send the task for admin review."
                ),
            )
        task.status = payload.status
    if payload.progress is not None:
        task.progress = payload.progress
    if task.status == TaskStatus.COMPLETED:
        task.progress = 100
    elif task.status == TaskStatus.TODO and task.progress > 0:
        task.status = TaskStatus.IN_PROGRESS
    elif task.progress >= 100 and task.status in {
        TaskStatus.TODO,
        TaskStatus.IN_PROGRESS,
        TaskStatus.ON_HOLD,
    }:
        task.status = TaskStatus.COMPLETED

    if task.status != old_status:
        changes.append(f"status {old_status.value} → {task.status.value}")
    if task.progress != old_progress:
        changes.append(f"progress {old_progress}% → {task.progress}%")
    if changes:
        log_activity(
            db,
            user.id,
            "task_updated",
            "task",
            task.id,
            description=f"Updated task '{task.title}': {', '.join(changes)}",
            title=task.title,
        )
    if old_project_id != task.project_id:
        recalc_project_progress(db, old_project_id)
    recalc_project_progress(db, task.project_id)
    db.commit()
    db.refresh(task)
    return get_my_task(db, user, task.id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: CurrentEmployee, db: DbSession) -> None:
    task = get_my_task(db, user, task_id)
    project_id = task.project_id
    title = task.title
    db.delete(task)
    log_activity(
        db,
        user.id,
        "task_deleted",
        "task",
        task_id,
        description=f"Deleted task '{title}'",
        title=title,
    )
    recalc_project_progress(db, project_id)
    db.commit()


@router.post("/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    task_id: int, payload: CommentCreate, user: CurrentEmployee, db: DbSession
) -> TaskComment:
    task = get_my_task(db, user, task_id)
    comment = TaskComment(task_id=task.id, user_id=user.id, content=payload.content.strip())
    db.add(comment)
    log_activity(
        db,
        user.id,
        "task_commented",
        "task",
        task.id,
        description=f"Commented on task '{task.title}'",
        title=task.title,
    )
    db.commit()
    db.refresh(comment)
    return comment


@router.post(
    "/{task_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_attachment(
    task_id: int,
    user: CurrentEmployee,
    db: DbSession,
    file: Annotated[UploadFile, File(description="File to attach")],
) -> TaskAttachment:
    task = get_my_task(db, user, task_id)
    _ensure_not_locked(task)
    filename, path = save_upload(file, f"tasks/{task.id}")
    attachment = TaskAttachment(task_id=task.id, user_id=user.id, filename=filename, file_path=path)
    db.add(attachment)
    log_activity(
        db,
        user.id,
        "task_attachment_added",
        "task",
        task.id,
        description=f"Attached '{filename}' to task '{task.title}'",
        title=task.title,
    )
    db.commit()
    db.refresh(attachment)
    return attachment


@router.post("/{task_id}/submit-review", response_model=TaskOut)
def submit_for_review(task_id: int, user: CurrentEmployee, db: DbSession) -> Task:
    task = get_my_task(db, user, task_id)
    _ensure_not_locked(task)

    task.status = TaskStatus.IN_REVIEW
    task.progress = 100
    task.submitted_for_review_at = utcnow()
    log_activity(
        db,
        user.id,
        "task_submitted_for_review",
        "task",
        task.id,
        description=f"Submitted task '{task.title}' for review",
        title=task.title,
    )
    notify_admins(
        db,
        title="Task submitted for review",
        message=f"{user.full_name} submitted task '{task.title}' for review.",
        type=NotificationType.TASK,
        link=f"/admin/tasks/{task.id}",
    )
    recalc_project_progress(db, task.project_id)
    db.commit()
    db.refresh(task)
    return task
