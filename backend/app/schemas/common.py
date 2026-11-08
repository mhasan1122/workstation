from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.enums import UserRole
from app.services.files import file_url


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    message: str


class UserBrief(ORMModel):
    id: int
    full_name: str
    profile_picture: str | None = None
    role: UserRole


class AttachmentOut(ORMModel):
    id: int
    user_id: int | None = None
    filename: str
    file_path: str
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str | None:
        return file_url(self.file_path)


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class CommentOut(ORMModel):
    id: int
    user_id: int | None = None
    user: UserBrief | None = None
    content: str
    created_at: datetime
