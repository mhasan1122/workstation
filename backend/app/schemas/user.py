from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator

from app.models.enums import UserRole
from app.schemas.common import ORMModel
from app.services.files import file_url


class UserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    joining_date: date | None = None
    profile_picture: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def profile_picture_url(self) -> str | None:
        return file_url(self.profile_picture)


class ProfileUpdate(BaseModel):
    """Only fields an employee may change. Everything else is admin-controlled."""

    model_config = ConfigDict(extra="forbid")

    phone: str | None = Field(default=None, max_length=30)
    profile_picture: str | None = Field(default=None, max_length=500)

    @field_validator("phone")
    @classmethod
    def _clean_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None
