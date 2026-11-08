from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.deps import CurrentEmployee, DbSession
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserOut
from app.services.activity import log_activity
from app.services.files import delete_stored_file, save_upload

router = APIRouter(prefix="/profile", tags=["profile"])


def _own_picture_prefix(user: User) -> str:
    return f"profiles/{user.id}/"


def _normalize_picture(user: User, value: str | None) -> str | None:
    """Accept null (remove), an external http(s) URL, or a path inside the user's own
    profile upload folder. Anything else is rejected so one user can never point at
    (and later delete) another user's files."""
    if value is None or not value.strip():
        return None
    value = value.strip()
    if value.startswith(("http://", "https://")):
        return value
    if value.startswith("/uploads/"):
        value = value.removeprefix("/uploads/")
    if ".." in value or not value.startswith(_own_picture_prefix(user)):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="profile_picture must be an http(s) URL or a file uploaded via /profile/picture",
        )
    return value


def _remove_old_picture(user: User, old: str | None, new: str | None) -> None:
    if old and old != new and old.startswith(_own_picture_prefix(user)):
        delete_stored_file(old)


@router.get("", response_model=UserOut)
def get_profile(user: CurrentEmployee) -> User:
    return user


@router.patch("", response_model=UserOut)
def update_profile(payload: ProfileUpdate, user: CurrentEmployee, db: DbSession) -> User:
    """Employees can only change phone and profile picture. Name, e-mail, employee id,
    department and designation are managed by admins; use /auth/change-password for passwords."""
    changes = payload.model_dump(exclude_unset=True)
    if "phone" in changes:
        user.phone = changes["phone"]
    if "profile_picture" in changes:
        old = user.profile_picture
        user.profile_picture = _normalize_picture(user, changes["profile_picture"])
        _remove_old_picture(user, old, user.profile_picture)
    if changes:
        log_activity(db, user.id, "profile_updated", "user", user.id, description="Updated profile")
        db.commit()
        db.refresh(user)
    return user


@router.post("/picture", response_model=UserOut)
def upload_profile_picture(
    user: CurrentEmployee,
    db: DbSession,
    file: Annotated[UploadFile, File(description="Image file (jpg, png, gif, webp)")],
) -> User:
    _, path = save_upload(file, f"profiles/{user.id}", images_only=True)
    old = user.profile_picture
    user.profile_picture = path
    log_activity(
        db, user.id, "profile_picture_updated", "user", user.id, description="Updated profile picture"
    )
    db.commit()
    db.refresh(user)
    _remove_old_picture(user, old, path)
    return user
