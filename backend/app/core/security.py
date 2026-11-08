import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def create_access_token(
    subject: int | str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    if payload.get("type") != "access" or "sub" not in payload:
        return None
    return payload


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_reset_token() -> tuple[str, str]:
    """Return (plain_token, hashed_token). Only the hash is stored."""
    plain = secrets.token_urlsafe(32)
    return plain, hash_token(plain)


def generate_otp(length: int | None = None) -> tuple[str, str]:
    """Return (plain_otp, hashed_otp). Only the hash is stored."""
    digits = length or settings.otp_length
    # Cryptographically strong numeric OTP (zero-padded)
    upper = 10**digits
    plain = f"{secrets.randbelow(upper):0{digits}d}"
    return plain, hash_token(plain)
