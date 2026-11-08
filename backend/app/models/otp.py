from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import utcnow


class EmailOTP(Base):
    """One-time codes for registration and password reset (hashed at rest)."""

    __tablename__ = "email_otps"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    full_name: Mapped[str | None] = mapped_column(String(150))
    purpose: Mapped[str] = mapped_column(String(40), index=True)  # register | password_reset
    otp_hash: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
