from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import NotificationType, UserRole
from app.models.notification import ActivityLog, Notification
from app.models.user import User


def log_activity(
    db: Session,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    description: str | None = None,
    **meta: Any,
) -> ActivityLog:
    """Add an activity log row to the session (caller commits)."""
    payload: dict[str, Any] = dict(meta)
    if description:
        payload["description"] = description
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        meta=payload or None,
    )
    db.add(entry)
    return entry


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: NotificationType | str = NotificationType.SYSTEM,
    link: str | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=str(type.value if isinstance(type, NotificationType) else type),
        link=link,
    )
    db.add(notification)
    return notification


def notify_admins(
    db: Session,
    title: str,
    message: str,
    type: NotificationType | str = NotificationType.SYSTEM,
    link: str | None = None,
) -> None:
    admin_ids = db.scalars(
        select(User.id).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
    ).all()
    for admin_id in admin_ids:
        notify_user(db, admin_id, title, message, type, link)
