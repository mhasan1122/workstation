from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import enum_type, utcnow
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Legacy / optional internal code — not used in the employee portal UI
    employee_id: Mapped[str | None] = mapped_column(String(30), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(30))
    department: Mapped[str | None] = mapped_column(String(100))
    designation: Mapped[str | None] = mapped_column(String(100))
    joining_date: Mapped[date | None] = mapped_column(Date)
    profile_picture: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[UserRole] = mapped_column(
        enum_type(UserRole), default=UserRole.EMPLOYEE, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # SHA-256 hash of the password reset token (the plain token is never stored)
    reset_token: Mapped[str | None] = mapped_column(String(128), index=True)
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    def __repr__(self) -> str:
        return f"<User {self.id} {self.email}>"
