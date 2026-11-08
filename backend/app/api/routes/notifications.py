from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import CurrentEmployee, DbSession
from app.models.notification import Notification
from app.schemas.common import MessageResponse
from app.schemas.notification import NotificationList, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _unread_count(db: Session, user_id: int) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        or 0
    )


@router.get("", response_model=NotificationList)
def list_notifications(
    user: CurrentEmployee,
    db: DbSession,
    unread_only: bool = False,
    type: Annotated[str | None, Query(max_length=30)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> NotificationList:
    conditions = [Notification.user_id == user.id]
    if unread_only:
        conditions.append(Notification.is_read.is_(False))
    if type:
        conditions.append(Notification.type == type)

    total = db.scalar(select(func.count()).select_from(Notification).where(*conditions)) or 0
    items = db.scalars(
        select(Notification)
        .where(*conditions)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return NotificationList(
        items=[NotificationOut.model_validate(n) for n in items],
        total=total,
        unread_count=_unread_count(db, user.id),
    )


@router.get("/unread-count")
def unread_count(user: CurrentEmployee, db: DbSession) -> dict[str, int]:
    return {"unread_count": _unread_count(db, user.id)}


@router.patch("/read-all", response_model=MessageResponse)
def mark_all_read(user: CurrentEmployee, db: DbSession) -> MessageResponse:
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return MessageResponse(message=f"Marked {result.rowcount or 0} notifications as read")


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, user: CurrentEmployee, db: DbSession) -> Notification:
    notification = db.scalars(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    ).first()
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification
