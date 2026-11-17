from __future__ import annotations

from typing import Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, verify_unknown_user_password
from app.models.society import Society
from app.models.user import User
from app.repositories.user_repo import UserRepository


class UserServiceError(Exception):
    """Base exception for user service errors."""


class InvalidInviteCodeError(UserServiceError):
    """Raised when an invalid society invite code is supplied."""


class DuplicateAccountError(UserServiceError):
    """Raised when username or phone is already taken."""


class InvalidCredentialsError(UserServiceError):
    """Raised when authentication credentials fail."""


def create_resident(
    session: Session,
    *,
    username: str,
    password: str,
    full_name: str,
    phone: str,
    unit_label: str,
    invite_code: str,
) -> User:
    """Validate invite code, verify uniqueness, and persist new resident user."""
    society = session.scalar(
        select(Society).where(func.lower(Society.invite_code) == invite_code.lower())
    )
    if society is None:
        raise InvalidInviteCodeError(f"Society with invite code '{invite_code}' not found")

    user_repo = UserRepository(session)
    existing_user = session.scalar(
        select(User).where(or_(User.username == username, User.phone == phone))
    )
    if existing_user is not None:
        raise DuplicateAccountError("Username or phone number is already registered")

    resident = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        phone=phone,
        role="resident",
        society_id=society.id,
        unit_label=unit_label,
        is_active=True,
    )
    user_repo.create(resident)
    return resident


def authenticate_user(session: Session, *, username: str, password: str) -> User:
    """Authenticate user with constant-time dummy verification on miss."""
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        verify_unknown_user_password(password)
        raise InvalidCredentialsError("Invalid username or password")

    password_matches = verify_password(password, user.password_hash)
    if not password_matches or not user.is_active:
        raise InvalidCredentialsError("Invalid username or password")

    return user


def list_vendors(session: Session) -> Sequence[User]:
    """List all active vendors."""
    return UserRepository(session).list_vendors(active_only=True)
