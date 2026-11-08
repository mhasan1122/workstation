from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Enum as SAEnum


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_type(enum_cls: type[Enum], length: int = 30) -> SAEnum:
    """Store enum *values* in a plain VARCHAR (no native PG enum) so that the
    Admin Panel and migrations can evolve the allowed values easily."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda e: [member.value for member in e],
        validate_strings=True,
    )
