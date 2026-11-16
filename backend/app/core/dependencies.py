from __future__ import annotations

from typing import Callable, Literal
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import ACCESS_COOKIE_NAME
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.domain import User

UserRole = Literal["resident", "vendor", "ops"]


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication credentials",
    )


def get_current_user(
    request: Request,
    session: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if token is None:
        raise _unauthorized()

    try:
        claims = decode_access_token(token)
        subject = claims["sub"]
        if not isinstance(subject, str):
            raise _unauthorized()
        user_id = str(UUID(subject))
    except (jwt.InvalidTokenError, ValueError):
        raise _unauthorized() from None

    user = session.scalar(
        select(User)
        .options(joinedload(User.society))
        .where(User.id == user_id)
    )
    if user is None or not user.is_active:
        raise _unauthorized()
    return user


def require_role(required_role: UserRole) -> Callable[..., User]:
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency
