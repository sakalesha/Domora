from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.camp import Camp
from app.models.user import User
from app.repositories.order_repo import OrderRepository


class OrderServiceError(Exception):
    """Base exception for order and booking service operations."""


class CampNotOpenError(OrderServiceError):
    """Raised when trying to book into a camp that is not open."""


class CampCapacityExceededError(OrderServiceError):
    """Raised when camp maximum participants ceiling is reached."""


class AlreadyBookedError(OrderServiceError):
    """Raised when resident already has an active booking in this camp."""


class BookingNotFoundError(OrderServiceError):
    """Raised when booking cannot be found."""


def create_order(
    session: Session,
    *,
    camp_id: str,
    resident: User,
    slot_starts_at: datetime | None = None,
) -> Booking:
    """Create a new booking / order for a resident in an open camp."""
    camp = session.get(Camp, camp_id)
    if camp is None or camp.status != "open":
        raise CampNotOpenError(f"Camp '{camp_id}' is not currently open for bookings")

    now = datetime.now(timezone.utc)
    camp_deadline = camp.join_deadline if camp.join_deadline.tzinfo else camp.join_deadline.replace(tzinfo=timezone.utc)
    if now >= camp_deadline:
        raise CampNotOpenError("Camp join deadline has already passed")

    order_repo = OrderRepository(session)
    existing = order_repo.get_by_camp_and_resident(camp_id, resident.id)
    if existing is not None:
        raise AlreadyBookedError("Resident already has an active booking in this camp")

    active_bookings = order_repo.get_active_bookings_for_camp(camp_id)
    if len(active_bookings) >= camp.max_participants:
        raise CampCapacityExceededError("Camp has reached maximum capacity")

    booking = Booking(
        camp_id=camp.id,
        resident_id=resident.id,
        status="joined",
        quoted_price_paise=camp.base_price_paise,
        slot_starts_at=slot_starts_at,
    )
    order_repo.create(booking)
    session.commit()
    return booking


def cancel_order(session: Session, booking_id: str, resident_id: str) -> Booking:
    """Cancel an active booking."""
    order_repo = OrderRepository(session)
    booking = order_repo.get_by_id(booking_id)
    if booking is None or booking.resident_id != resident_id:
        raise BookingNotFoundError(f"Booking '{booking_id}' not found")

    booking.status = "cancelled"
    booking.cancelled_at = datetime.now(timezone.utc)
    session.commit()
    return booking


def list_resident_orders(session: Session, resident_id: str) -> Sequence[Booking]:
    """List all bookings for a resident."""
    return OrderRepository(session).list_by_resident(resident_id)
