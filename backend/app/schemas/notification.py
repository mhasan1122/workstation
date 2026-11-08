from datetime import datetime
from typing import Any

from pydantic import computed_field

from app.schemas.common import ORMModel


class NotificationOut(ORMModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    link: str | None = None
    created_at: datetime


class NotificationList(ORMModel):
    items: list[NotificationOut]
    total: int
    unread_count: int


class ActivityOut(ORMModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def description(self) -> str:
        if self.meta and self.meta.get("description"):
            return str(self.meta["description"])
        return f"{self.action.replace('_', ' ').capitalize()} ({self.entity_type})"
