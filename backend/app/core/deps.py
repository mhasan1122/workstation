from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise unauthorized
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise unauthorized from None

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_employee(user: CurrentUser) -> User:
    if user.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee access required",
        )
    return user


def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


CurrentEmployee = Annotated[User, Depends(require_employee)]
CurrentAdmin = Annotated[User, Depends(require_admin)]
