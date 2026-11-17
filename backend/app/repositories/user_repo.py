from __future__ import annotations

from typing import Sequence
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User entity persistence and query operations."""

    def __init__(self, session: Session) -> None:
        super().__init__(User, session)

    def get_by_username(self, username: str, load_society: bool = True) -> User | None:
        """Fetch user by unique username with optional eager society join."""
        stmt = select(User).where(User.username == username)
        if load_society:
            stmt = stmt.options(joinedload(User.society))
        return self.session.scalar(stmt)

    def get_by_phone(self, phone: str) -> User | None:
        """Fetch user by unique phone number."""
        return self.session.scalar(select(User).where(User.phone == phone))

    def list_vendors(self, active_only: bool = True) -> Sequence[User]:
        """Fetch all vendors ordered by full name."""
        stmt = select(User).where(User.role == "vendor")
        if active_only:
            stmt = stmt.where(User.is_active == True)  # noqa: E712
        return self.session.scalars(stmt.order_by(User.full_name.asc())).all()

    def list_residents_by_society(self, society_id: str) -> Sequence[User]:
        """Fetch all residents belonging to a specific society."""
        stmt = (
            select(User)
            .where(User.role == "resident", User.society_id == society_id)
            .order_by(User.unit_label.asc())
        )
        return self.session.scalars(stmt).all()
