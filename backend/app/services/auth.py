from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, verify_unknown_user_password
from app.models.domain import Society, User


class InvalidInviteCodeError(Exception):
    pass


class DuplicateAccountError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


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
    society = session.scalar(
        select(Society).where(func.lower(Society.invite_code) == invite_code.lower())
    )
    if society is None:
        raise InvalidInviteCodeError

    existing_user = session.scalar(
        select(User).where(or_(User.username == username, User.phone == phone))
    )
    if existing_user is not None:
        raise DuplicateAccountError

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
    session.add(resident)
    return resident


def authenticate_user(session: Session, *, username: str, password: str) -> User:
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        verify_unknown_user_password(password)
        raise InvalidCredentialsError

    password_matches = verify_password(password, user.password_hash)
    if not password_matches or not user.is_active:
        raise InvalidCredentialsError
    return user
