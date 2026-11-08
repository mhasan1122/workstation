from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentEmployee, DbSession
from app.models.enums import MilestoneStatus, NotificationType, Priority
from app.models.milestone import Milestone, MilestoneAttachment, MilestoneComment
from app.schemas.common import AttachmentOut, CommentCreate, CommentOut
from app.schemas.milestone import MilestoneDetail, MilestoneOut, MilestoneUpdate
from app.services.access import get_my_milestone
from app.services.activity import log_activity, notify_admins
from app.services.files import save_upload

router = APIRouter(prefix="/milestones", tags=["milestones"])

EMPLOYEE_SETTABLE = {
    MilestoneStatus.PENDING,
    MilestoneStatus.IN_PROGRESS,
    MilestoneStatus.COMPLETED,
}
LOCKED = {MilestoneStatus.IN_REVIEW, MilestoneStatus.COMPLETED}


def _ensure_not_locked(milestone: Milestone) -> None:
    if milestone.status in LOCKED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Milestone is '{milestone.status.value}' and cannot be modified",
        )


@router.get("", response_model=list[MilestoneOut])
def list_milestones(
    user: CurrentEmployee,
    db: DbSession,
    status_filter: Annotated[MilestoneStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
    project_id: int | None = None,
    personal: bool | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> list[Milestone]:
    stmt = (
        select(Milestone)
        .where(Milestone.assigned_to == user.id)
        .options(selectinload(Milestone.project))
    )
    if status_filter is not None:
        stmt = stmt.where(Milestone.status == status_filter)
    if priority is not None:
        stmt = stmt.where(Milestone.priority == priority)
    if project_id is not None:
        stmt = stmt.where(Milestone.project_id == project_id)
    if personal is True:
        stmt = stmt.where(Milestone.project_id.is_(None))
    elif personal is False:
        stmt = stmt.where(Milestone.project_id.is_not(None))
    if search:
        stmt = stmt.where(Milestone.title.ilike(f"%{search.strip()}%"))
    stmt = stmt.order_by(Milestone.deadline.asc().nulls_last(), Milestone.id.desc())
    return list(db.scalars(stmt))


@router.get("/{milestone_id}", response_model=MilestoneDetail)
def get_milestone(milestone_id: int, user: CurrentEmployee, db: DbSession) -> Milestone:
    return get_my_milestone(db, user, milestone_id, detail=True)


@router.patch("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: int, payload: MilestoneUpdate, user: CurrentEmployee, db: DbSession
) -> Milestone:
    milestone = get_my_milestone(db, user, milestone_id)
    if payload.progress is None and payload.status is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Provide progress and/or status")
    _ensure_not_locked(milestone)

    old_status, old_progress = milestone.status, milestone.progress

    if payload.status is not None:
        if payload.status not in EMPLOYEE_SETTABLE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Status can only be set to pending, in_progress or completed. "
                    "Use /submit-review to send the milestone for admin review."
                ),
            )
        milestone.status = payload.status
    if payload.progress is not None:
        milestone.progress = payload.progress
    if milestone.status == MilestoneStatus.COMPLETED:
        milestone.progress = 100
    elif milestone.status == MilestoneStatus.PENDING and milestone.progress > 0:
        milestone.status = MilestoneStatus.IN_PROGRESS
    elif milestone.progress >= 100 and milestone.status in {
        MilestoneStatus.PENDING,
        MilestoneStatus.IN_PROGRESS,
    }:
        milestone.status = MilestoneStatus.COMPLETED

    changes = []
    if milestone.status != old_status:
        changes.append(f"status {old_status.value} → {milestone.status.value}")
    if milestone.progress != old_progress:
        changes.append(f"progress {old_progress}% → {milestone.progress}%")
    if changes:
        log_activity(
            db,
            user.id,
            "milestone_updated",
            "milestone",
            milestone.id,
            description=f"Updated milestone '{milestone.title}': {', '.join(changes)}",
            title=milestone.title,
        )
    db.commit()
    db.refresh(milestone)
    return milestone


@router.post(
    "/{milestone_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
def add_comment(
    milestone_id: int, payload: CommentCreate, user: CurrentEmployee, db: DbSession
) -> MilestoneComment:
    milestone = get_my_milestone(db, user, milestone_id)
    comment = MilestoneComment(
        milestone_id=milestone.id, user_id=user.id, content=payload.content.strip()
    )
    db.add(comment)
    log_activity(
        db,
        user.id,
        "milestone_commented",
        "milestone",
        milestone.id,
        description=f"Commented on milestone '{milestone.title}'",
        title=milestone.title,
    )
    db.commit()
    db.refresh(comment)
    return comment


@router.post(
    "/{milestone_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_attachment(
    milestone_id: int,
    user: CurrentEmployee,
    db: DbSession,
    file: Annotated[UploadFile, File(description="File to attach")],
) -> MilestoneAttachment:
    milestone = get_my_milestone(db, user, milestone_id)
    if milestone.status == MilestoneStatus.COMPLETED:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Milestone is completed")
    filename, path = save_upload(file, f"milestones/{milestone.id}")
    attachment = MilestoneAttachment(
        milestone_id=milestone.id, user_id=user.id, filename=filename, file_path=path
    )
    db.add(attachment)
    log_activity(
        db,
        user.id,
        "milestone_attachment_added",
        "milestone",
        milestone.id,
        description=f"Attached '{filename}' to milestone '{milestone.title}'",
        title=milestone.title,
    )
    db.commit()
    db.refresh(attachment)
    return attachment


@router.post("/{milestone_id}/submit-review", response_model=MilestoneOut)
def submit_for_review(milestone_id: int, user: CurrentEmployee, db: DbSession) -> Milestone:
    milestone = get_my_milestone(db, user, milestone_id)
    _ensure_not_locked(milestone)

    milestone.status = MilestoneStatus.IN_REVIEW
    milestone.progress = 100
    log_activity(
        db,
        user.id,
        "milestone_submitted_for_review",
        "milestone",
        milestone.id,
        description=f"Submitted milestone '{milestone.title}' for review",
        title=milestone.title,
    )
    notify_admins(
        db,
        title="Milestone submitted for review",
        message=f"{user.full_name} submitted milestone '{milestone.title}' for review.",
        type=NotificationType.MILESTONE,
        link=f"/admin/milestones/{milestone.id}",
    )
    db.commit()
    db.refresh(milestone)
    return milestone

