import logging
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select

from app.core.config import get_settings
from app.core.deps import CurrentUser, DbSession
from app.core.security import (
    create_access_token,
    generate_otp,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.base import utcnow
from app.models.enums import UserRole
from app.models.otp import EmailOTP
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyRegistrationRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserOut
from app.services.activity import log_activity
from app.services.email import send_otp_email

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])

_DUMMY_HASH = hash_password("not-a-real-password")
PURPOSE_REGISTER = "register"
PURPOSE_RESET = "password_reset"


def _purge_otps(db: DbSession, email: str, purpose: str) -> None:
    db.execute(
        delete(EmailOTP).where(
            func.lower(EmailOTP.email) == email.lower(),
            EmailOTP.purpose == purpose,
        )
    )


def _store_and_send_otp(
    db: DbSession,
    *,
    email: str,
    purpose: str,
    full_name: str | None = None,
) -> None:
    plain, hashed = generate_otp()
    _purge_otps(db, email, purpose)
    db.add(
        EmailOTP(
            email=email.lower(),
            full_name=(full_name or "").strip() or None,
            purpose=purpose,
            otp_hash=hashed,
            expires_at=utcnow() + timedelta(minutes=settings.otp_expire_minutes),
        )
    )
    db.commit()
    try:
        send_otp_email(email, plain, purpose=purpose, name=full_name)
    except Exception:
        logger.exception("Failed to send OTP email to %s", email)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Could not send verification email. Please try again shortly.",
        )


def _consume_otp(db: DbSession, email: str, purpose: str, otp: str) -> EmailOTP:
    row = db.scalars(
        select(EmailOTP)
        .where(
            func.lower(EmailOTP.email) == email.lower(),
            EmailOTP.purpose == purpose,
            EmailOTP.otp_hash == hash_token(otp.strip()),
        )
        .order_by(EmailOTP.id.desc())
    ).first()
    if row is None or row.expires_at < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
    return row


@router.post("/register", response_model=MessageResponse)
def register(payload: RegisterRequest, db: DbSession) -> MessageResponse:
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    existing = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    _store_and_send_otp(db, email=email, purpose=PURPOSE_REGISTER, full_name=full_name)
    return MessageResponse(message="OTP sent to your email. Enter the code to verify your account.")


@router.post("/verify-registration", response_model=TokenResponse)
def verify_registration(payload: VerifyRegistrationRequest, db: DbSession) -> TokenResponse:
    email = payload.email.strip().lower()
    existing = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    otp_row = _consume_otp(db, email, PURPOSE_REGISTER, payload.otp)
    full_name = otp_row.full_name or email.split("@")[0]

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=full_name,
        role=UserRole.EMPLOYEE,
        is_active=True,
    )
    db.add(user)
    _purge_otps(db, email, PURPOSE_REGISTER)
    db.flush()
    log_activity(db, user.id, "register", "user", user.id, description="Account created via email OTP")
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, db: DbSession) -> MessageResponse:
    email = payload.email.strip().lower()
    user = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    # Always look the same to the client; only send when the account exists.
    if user is not None and user.is_active:
        user_id = user.id
        full_name = user.full_name
        try:
            _store_and_send_otp(
                db,
                email=email,
                purpose=PURPOSE_RESET,
                full_name=full_name,
            )
            log_activity(db, user_id, "password_reset_requested", "user", user_id)
            db.commit()
        except HTTPException:
            # Surface email delivery failures so the user can retry.
            raise
    return MessageResponse(message="If an account with that email exists, an OTP has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: DbSession) -> MessageResponse:
    email = payload.email.strip().lower()
    user = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    _consume_otp(db, email, PURPOSE_RESET, payload.otp)
    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    _purge_otps(db, email, PURPOSE_RESET)
    log_activity(db, user.id, "password_reset", "user", user.id, description="Password reset via OTP")
    db.commit()
    return MessageResponse(message="Password has been reset successfully")


@router.post("/resend-otp", response_model=MessageResponse)
def resend_otp(payload: ResendOtpRequest, db: DbSession) -> MessageResponse:
    email = payload.email.strip().lower()
    purpose = payload.purpose

    if purpose == PURPOSE_REGISTER:
        if db.scalars(select(User).where(func.lower(User.email) == email)).first():
            raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists")
        latest = db.scalars(
            select(EmailOTP)
            .where(func.lower(EmailOTP.email) == email, EmailOTP.purpose == PURPOSE_REGISTER)
            .order_by(EmailOTP.id.desc())
        ).first()
        if latest is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Start registration first")
        _store_and_send_otp(db, email=email, purpose=PURPOSE_REGISTER, full_name=latest.full_name)
        return MessageResponse(message="A new OTP has been sent to your email.")

    user = db.scalars(select(User).where(func.lower(User.email) == email)).first()
    if user is None or not user.is_active:
        return MessageResponse(message="If an account with that email exists, an OTP has been sent.")
    _store_and_send_otp(db, email=email, purpose=PURPOSE_RESET, full_name=user.full_name)
    return MessageResponse(message="If an account with that email exists, an OTP has been sent.")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    email = payload.email.strip().lower()
    user = db.scalars(select(User).where(func.lower(User.email) == email)).first()

    if user is None:
        verify_password(payload.password, _DUMMY_HASH)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(user.id, user.role.value)
    log_activity(db, user.id, "login", "user", user.id, description="Signed in")
    db.commit()
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(user: CurrentUser) -> MessageResponse:
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.patch("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbSession
) -> MessageResponse:
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="New password must differ from the current password"
        )
    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    log_activity(db, user.id, "password_changed", "user", user.id, description="Changed password")
    db.commit()
    return MessageResponse(message="Password changed successfully")
