from __future__ import annotations

from typing import Sequence
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.booking import Booking
from app.models.camp import Camp
from app.repositories.base import BaseRepository


class CampRepository(BaseRepository[Camp]):
    """Repository for Camp persistence and relational queries."""

    def __init__(self, session: Session) -> None:
        super().__init__(Camp, session)

    def get_with_details(self, camp_id: str) -> Camp | None:
        """Fetch camp with society, service, vendor, price tiers, and bookings."""
        stmt = (
            select(Camp)
            .options(
                joinedload(Camp.society),
                joinedload(Camp.service),
                joinedload(Camp.vendor),
                selectinload(Camp.price_tiers),
                selectinload(Camp.bookings).joinedload(Booking.resident),
            )
            .where(Camp.id == camp_id)
        )
        return self.session.scalar(stmt)

    def list_camps(
        self,
        society_id: str | None = None,
        status: str | None = None,
    ) -> Sequence[Camp]:
        """List camps with optional society and status filters."""
        stmt = (
            select(Camp)
            .options(
                joinedload(Camp.society),
                joinedload(Camp.service),
                joinedload(Camp.vendor),
                selectinload(Camp.price_tiers),
                selectinload(Camp.bookings),
            )
            .order_by(Camp.created_at.desc())
        )
        if society_id:
            stmt = stmt.where(Camp.society_id == society_id)
        if status:
            stmt = stmt.where(Camp.status == status)

        return self.session.scalars(stmt).unique().all()
