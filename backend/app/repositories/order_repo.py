from __future__ import annotations

from typing import Sequence
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.repositories.base import BaseRepository


class OrderRepository(BaseRepository[Booking]):
    """Repository for Booking / Order persistence and queries."""

    def __init__(self, session: Session) -> None:
        super().__init__(Booking, session)

    def get_by_id_with_details(self, booking_id: str) -> Booking | None:
        """Fetch booking with resident and camp eager joined."""
        stmt = (
            select(Booking)
            .options(
                joinedload(Booking.resident),
                joinedload(Booking.camp),
                joinedload(Booking.job_record),
            )
            .where(Booking.id == booking_id)
        )
        return self.session.scalar(stmt)

    def get_active_bookings_for_camp(self, camp_id: str) -> Sequence[Booking]:
        """Fetch all active (non-cancelled) bookings for a camp in join order."""
        stmt = (
            select(Booking)
            .options(joinedload(Booking.resident))
            .where(Booking.camp_id == camp_id, Booking.status != "cancelled")
            .order_by(Booking.created_at.asc())
        )
        return self.session.scalars(stmt).all()

    def get_by_camp_and_resident(self, camp_id: str, resident_id: str) -> Booking | None:
        """Find active booking for resident in camp."""
        stmt = select(Booking).where(
            Booking.camp_id == camp_id,
            Booking.resident_id == resident_id,
            Booking.status != "cancelled",
        )
        return self.session.scalar(stmt)

    def list_by_resident(self, resident_id: str) -> Sequence[Booking]:
        """Fetch all bookings created by a resident."""
        stmt = (
            select(Booking)
            .options(joinedload(Booking.camp))
            .where(Booking.resident_id == resident_id)
            .order_by(Booking.created_at.desc())
        )
        return self.session.scalars(stmt).all()


BookingRepository = OrderRepository
