from __future__ import annotations

import threading
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.domain import Booking, Camp, CampPriceTier, User
from app.schemas.booking import (
    ResidentBookingDetail,
    ResidentBookingItem,
    ResidentBookingLeaveResponse,
    ResidentCampSummaryForBooking,
)
from app.schemas.resident import (
    ResidentBookingSummary,
    ResidentCampDetail,
    ResidentCampListItem,
    ResidentNextTier,
    ResidentServiceSummary,
    ResidentSocietySummary,
    ResidentTierItem,
)
from app.services.pricing import (
    PriceTier,
    calculate_discount_pct,
    calculate_discounted_price_paise,
    calculate_pricing_quote,
)


class ResidentCampError(Exception):
    """Base exception for resident camp operations."""


class ResidentCampNotFoundError(ResidentCampError):
    """Raised when a camp is not found or does not belong to the resident's society."""


class ResidentSocietyRequiredError(ResidentCampError):
    """Raised when a resident user has no society associated with their account."""


class CampClosedError(ResidentCampError):
    """Raised when attempting to join a camp that is not open for bookings."""


class JoinDeadlinePassedError(ResidentCampError):
    """Raised when the join deadline for a camp has passed."""


class CampOvercapacityError(ResidentCampError):
    """Raised when a camp has reached maximum participant capacity."""


class DuplicateBookingError(ResidentCampError):
    """Raised when a resident already has an active booking in the camp."""


class BookingNotFoundError(ResidentCampError):
    """Raised when an active booking for a camp is not found."""


class LateCancellationError(ResidentCampError):
    """Raised when resident attempts to leave fewer than 24h before window start."""


_camp_locks: dict[str, threading.Lock] = {}
_camp_locks_guard = threading.Lock()


def _get_camp_lock(camp_id: str) -> threading.Lock:
    """Retrieve or create an in-process serialization lock for a specific camp."""
    with _camp_locks_guard:
        if camp_id not in _camp_locks:
            _camp_locks[camp_id] = threading.Lock()
        return _camp_locks[camp_id]


def _to_utc(dt: datetime) -> datetime:
    """Normalize datetime to timezone-aware UTC."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _paise_to_rupees(paise: int) -> float:
    """Convert integer paise to decimal rupees."""
    return round(paise / 100.0, 2)


def _build_resident_camp_item(camp: Camp, resident_id: str, now: datetime) -> ResidentCampListItem:
    """Build a resident-facing camp list summary item with dynamic pricing and capacity."""
    # Active bookings exclude cancelled reservations
    active_bookings = [b for b in camp.bookings if b.status != "cancelled"]
    participants_count = len(active_bookings)
    spots_remaining = max(0, camp.max_participants - participants_count)

    # Sort price tiers ascending by minimum participants
    sorted_tiers = sorted(camp.price_tiers, key=lambda t: t.min_participants)
    domain_tiers = [
        PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
        for t in sorted_tiers
    ]

    # Calculate pricing quote based on current headcount
    quote = calculate_pricing_quote(camp.base_price_paise, participants_count, domain_tiers)
    discount_pct = quote.discount_pct
    current_price_paise = quote.final_price_paise

    # Determine next tier motivation info if another tier exists
    next_tier_dto: ResidentNextTier | None = None
    if quote.next_tier is not None:
        target_price = calculate_discounted_price_paise(camp.base_price_paise, quote.next_tier.discount_pct)
        next_tier_dto = ResidentNextTier(
            more_needed=quote.next_tier.more_needed,
            target_participants=quote.next_tier.target_participants,
            discount_pct=quote.next_tier.discount_pct,
            target_price_paise=target_price,
            target_price_rupees=_paise_to_rupees(target_price),
        )

    # Check if the requesting resident already holds an active booking
    user_booking = next((b for b in active_bookings if b.resident_id == resident_id), None)
    user_booking_dto: ResidentBookingSummary | None = None
    if user_booking is not None:
        user_booking_dto = ResidentBookingSummary(
            id=user_booking.id,
            status=user_booking.status,
            quoted_price_paise=user_booking.quoted_price_paise,
            quoted_price_rupees=_paise_to_rupees(user_booking.quoted_price_paise),
            final_price_paise=user_booking.final_price_paise,
            final_price_rupees=_paise_to_rupees(user_booking.final_price_paise) if user_booking.final_price_paise is not None else None,
            slot_starts_at=user_booking.slot_starts_at,
        )

    is_confirmed_or_higher = camp.status in {"confirmed", "in_progress", "completed"}
    is_past_deadline = now >= _to_utc(camp.join_deadline)

    # A resident can join if the camp is open, capacity remains, deadline has not passed, and they have no active booking
    can_join = (
        camp.status == "open"
        and spots_remaining > 0
        and user_booking is None
        and not is_past_deadline
    )

    return ResidentCampListItem(
        id=camp.id,
        title=camp.title,
        status=camp.status,
        starts_at=camp.starts_at,
        ends_at=camp.ends_at,
        slot_minutes=camp.slot_minutes,
        join_deadline=camp.join_deadline,
        base_price_paise=camp.base_price_paise,
        base_price_rupees=_paise_to_rupees(camp.base_price_paise),
        current_price_paise=current_price_paise,
        current_price_rupees=_paise_to_rupees(current_price_paise),
        discount_pct=discount_pct,
        participants_count=participants_count,
        min_participants=camp.min_participants,
        max_participants=camp.max_participants,
        spots_remaining=spots_remaining,
        is_confirmed_or_higher=is_confirmed_or_higher,
        can_join=can_join,
        society=ResidentSocietySummary.model_validate(camp.society),
        service=ResidentServiceSummary.model_validate(camp.service),
        next_tier=next_tier_dto,
        user_booking=user_booking_dto,
    )


def _build_resident_camp_detail(camp: Camp, resident_id: str, now: datetime) -> ResidentCampDetail:
    """Build a detailed resident-facing camp view with tiered savings progression."""
    base_item = _build_resident_camp_item(camp, resident_id, now)

    sorted_tiers = sorted(camp.price_tiers, key=lambda t: t.min_participants)
    domain_tiers = [
        PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
        for t in sorted_tiers
    ]
    quote = calculate_pricing_quote(camp.base_price_paise, base_item.participants_count, domain_tiers)

    tiers_dto: list[ResidentTierItem] = []
    for tier in sorted_tiers:
        tier_price = calculate_discounted_price_paise(camp.base_price_paise, tier.discount_pct)
        if base_item.participants_count >= tier.min_participants:
            if tier.discount_pct == base_item.discount_pct:
                status_label = "current"
            else:
                status_label = "reached"
        else:
            if quote.next_tier and tier.min_participants == quote.next_tier.target_participants:
                status_label = "next"
            else:
                status_label = "upcoming"

        tiers_dto.append(
            ResidentTierItem(
                min_participants=tier.min_participants,
                discount_pct=tier.discount_pct,
                price_paise=tier_price,
                price_rupees=_paise_to_rupees(tier_price),
                status=status_label,
            )
        )

    return ResidentCampDetail(
        **base_item.model_dump(),
        tiers=tiers_dto,
    )


def list_resident_camps(
    session: Session,
    resident: User,
    status_filter: str | None = None,
) -> list[ResidentCampListItem]:
    """
    List all camps belonging strictly to the resident's society.
    Enforces society isolation.
    """
    if not resident.society_id:
        raise ResidentSocietyRequiredError("Resident must belong to a society to view camps")

    now = datetime.now(timezone.utc)
    stmt = (
        select(Camp)
        .options(
            joinedload(Camp.society),
            joinedload(Camp.service),
            selectinload(Camp.price_tiers),
            selectinload(Camp.bookings),
        )
        .where(Camp.society_id == resident.society_id)
    )

    if status_filter:
        stmt = stmt.where(Camp.status == status_filter)
    else:
        # Default: hide cancelled camps from the primary resident feed
        stmt = stmt.where(Camp.status != "cancelled")

    stmt = stmt.order_by(Camp.starts_at.asc())

    camps = session.scalars(stmt).unique().all()
    return [_build_resident_camp_item(camp, resident.id, now) for camp in camps]


def get_resident_camp_detail(
    session: Session,
    resident: User,
    camp_id: str,
) -> ResidentCampDetail:
    """
    Get detailed camp view for a resident.
    Enforces society isolation: raises ResidentCampNotFoundError if the camp
    does not exist or belongs to another society.
    """
    if not resident.society_id:
        raise ResidentSocietyRequiredError("Resident must belong to a society to view camps")

    now = datetime.now(timezone.utc)
    stmt = (
        select(Camp)
        .options(
            joinedload(Camp.society),
            joinedload(Camp.service),
            selectinload(Camp.price_tiers),
            selectinload(Camp.bookings),
        )
        .where(Camp.id == camp_id)
    )

    camp = session.scalar(stmt)
    if camp is None or camp.society_id != resident.society_id:
        raise ResidentCampNotFoundError(f"Camp '{camp_id}' not found")

    return _build_resident_camp_detail(camp, resident.id, now)


def join_camp(
    session: Session,
    resident: User,
    camp_id: str,
    *,
    now: datetime | None = None,
) -> ResidentBookingDetail:
    """
    Join an open camp in the resident's society.

    Uses row-level locking (with_for_update) on the Camp row within the transaction
    combined with in-process camp serialization to guarantee that active bookings never
    exceed max_participants under concurrent requests (Rule 2).

    Enforces:
    - Rule 3: Strict society isolation (ResidentCampNotFoundError -> 404).
    - Camp status must be 'open' (CampClosedError -> 422).
    - Rule 9: now < join_deadline (JoinDeadlinePassedError -> 422).
    - Rule 1: No duplicate active booking (DuplicateBookingError -> 409).
      Re-joining is permitted if a previous booking was cancelled.
    - Capacity check: active_count < max_participants (CampOvercapacityError -> 409).
    - Quoted price: calculated using Phase 3 pricing engine for new headcount (count + 1).
    """
    if not resident.society_id:
        raise ResidentSocietyRequiredError("Resident must belong to a society to join camps")

    current_time = _to_utc(now or datetime.now(timezone.utc))

    with _get_camp_lock(camp_id):
        # Lock the camp row to serialize concurrent joins against this camp
        camp = session.scalar(
            select(Camp)
            .options(
                joinedload(Camp.service),
                joinedload(Camp.society),
                selectinload(Camp.price_tiers),
            )
            .where(Camp.id == camp_id)
            .with_for_update()
        )

        if camp is None or camp.society_id != resident.society_id:
            raise ResidentCampNotFoundError("Camp not found")

        if camp.status != "open":
            raise CampClosedError(f"Cannot join camp with status '{camp.status}'")

        if current_time >= _to_utc(camp.join_deadline):
            raise JoinDeadlinePassedError("Join deadline has passed for this camp")

        # Check for existing active booking for this resident (Rule 1)
        existing_active = session.scalar(
            select(Booking)
            .where(
                Booking.camp_id == camp_id,
                Booking.resident_id == resident.id,
                Booking.status != "cancelled",
            )
        )
        if existing_active is not None:
            raise DuplicateBookingError("You already have an active booking in this camp")

        # Count current active bookings under the lock (Rule 2)
        active_count = session.scalar(
            select(func.count(Booking.id))
            .where(
                Booking.camp_id == camp_id,
                Booking.status != "cancelled",
            )
        ) or 0

        if active_count >= camp.max_participants:
            raise CampOvercapacityError("Camp has reached maximum participant capacity")

        # Calculate provisional quote for new headcount (active_count + 1)
        new_headcount = active_count + 1
        sorted_tiers = sorted(camp.price_tiers, key=lambda t: t.min_participants)
        domain_tiers = [
            PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
            for t in sorted_tiers
        ]
        quote = calculate_pricing_quote(camp.base_price_paise, new_headcount, domain_tiers)

        booking = Booking(
            id=str(uuid.uuid4()),
            camp_id=camp.id,
            resident_id=resident.id,
            status="joined",
            quoted_price_paise=quote.final_price_paise,
            final_price_paise=None,
            slot_starts_at=None,
            created_at=current_time,
            cancelled_at=None,
        )
        session.add(booking)
        session.commit()

        camp_summary = ResidentCampSummaryForBooking(
            id=camp.id,
            title=camp.title,
            service_name=camp.service.name,
            status=camp.status,
            starts_at=camp.starts_at,
            ends_at=camp.ends_at,
            base_price_paise=camp.base_price_paise,
            base_price_rupees=_paise_to_rupees(camp.base_price_paise),
            current_provisional_price_paise=quote.final_price_paise,
            current_provisional_price_rupees=_paise_to_rupees(quote.final_price_paise),
            current_discount_pct=quote.discount_pct,
            active_participants=new_headcount,
            spots_remaining=max(0, camp.max_participants - new_headcount),
        )

        return ResidentBookingDetail(
            id=booking.id,
            camp_id=booking.camp_id,
            resident_id=booking.resident_id,
            status=booking.status,
            quoted_price_paise=booking.quoted_price_paise,
            quoted_price_rupees=_paise_to_rupees(booking.quoted_price_paise),
            final_price_paise=booking.final_price_paise,
            final_price_rupees=_paise_to_rupees(booking.final_price_paise) if booking.final_price_paise is not None else None,
            slot_starts_at=booking.slot_starts_at,
            created_at=booking.created_at,
            cancelled_at=booking.cancelled_at,
            camp=camp_summary,
        )


def leave_camp(
    session: Session,
    resident: User,
    camp_id: str,
    *,
    now: datetime | None = None,
) -> ResidentBookingLeaveResponse:
    """
    Leave (cancel) the resident's active booking in a camp.

    Enforces the 24-hour cutoff rule:
    Cancellation is allowed only if now < camp.starts_at - 24 hours.
    Fewer than 24h prior to window start raises LateCancellationError (422).
    """
    current_time = _to_utc(now or datetime.now(timezone.utc))

    with _get_camp_lock(camp_id):
        booking = session.scalar(
            select(Booking)
            .options(joinedload(Booking.camp))
            .where(
                Booking.camp_id == camp_id,
                Booking.resident_id == resident.id,
                Booking.status != "cancelled",
            )
            .with_for_update()
        )

        if booking is None:
            raise BookingNotFoundError("No active booking found for this camp")

        # Enforce 24h cancellation lead time
        cutoff = _to_utc(booking.camp.starts_at) - timedelta(hours=24)
        if current_time >= cutoff:
            raise LateCancellationError(
                "Bookings cannot be cancelled within 24 hours of the service window start"
            )

        booking.status = "cancelled"
        booking.cancelled_at = current_time
        session.commit()

        return ResidentBookingLeaveResponse(
            id=booking.id,
            camp_id=booking.camp_id,
            status=booking.status,
            cancelled_at=booking.cancelled_at,
        )


def list_resident_bookings(
    session: Session,
    resident: User,
) -> list[ResidentBookingItem]:
    """
    List all bookings for the resident (active and historical) in reverse chronological order.
    """
    stmt = (
        select(Booking)
        .options(
            joinedload(Booking.camp).joinedload(Camp.service),
        )
        .where(Booking.resident_id == resident.id)
        .order_by(
            case((Booking.status != "cancelled", 0), else_=1),
            Booking.created_at.desc(),
        )
    )
    bookings = session.scalars(stmt).all()

    return [
        ResidentBookingItem(
            id=b.id,
            camp_id=b.camp_id,
            status=b.status,
            quoted_price_paise=b.quoted_price_paise,
            quoted_price_rupees=_paise_to_rupees(b.quoted_price_paise),
            final_price_paise=b.final_price_paise,
            final_price_rupees=_paise_to_rupees(b.final_price_paise) if b.final_price_paise is not None else None,
            slot_starts_at=b.slot_starts_at,
            created_at=b.created_at,
            cancelled_at=b.cancelled_at,
            camp_title=b.camp.title,
            service_name=b.camp.service.name,
            camp_status=b.camp.status,
            starts_at=b.camp.starts_at,
            ends_at=b.camp.ends_at,
        )
        for b in bookings
    ]


def get_resident_booking(
    session: Session,
    resident: User,
    booking_id: str,
) -> ResidentBookingDetail:
    """
    Get full details of a specific booking belonging to the resident.
    """
    booking = session.scalar(
        select(Booking)
        .options(
            joinedload(Booking.camp).joinedload(Camp.service),
            joinedload(Booking.camp).selectinload(Camp.price_tiers),
            joinedload(Booking.camp).selectinload(Camp.bookings),
        )
        .where(
            Booking.id == booking_id,
            Booking.resident_id == resident.id,
        )
    )
    if booking is None:
        raise BookingNotFoundError("Booking not found")

    camp = booking.camp
    active_count = sum(1 for b in camp.bookings if b.status != "cancelled")
    sorted_tiers = sorted(camp.price_tiers, key=lambda t: t.min_participants)
    domain_tiers = [
        PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
        for t in sorted_tiers
    ]
    quote = calculate_pricing_quote(camp.base_price_paise, active_count, domain_tiers)

    camp_summary = ResidentCampSummaryForBooking(
        id=camp.id,
        title=camp.title,
        service_name=camp.service.name,
        status=camp.status,
        starts_at=camp.starts_at,
        ends_at=camp.ends_at,
        base_price_paise=camp.base_price_paise,
        base_price_rupees=_paise_to_rupees(camp.base_price_paise),
        current_provisional_price_paise=quote.final_price_paise,
        current_provisional_price_rupees=_paise_to_rupees(quote.final_price_paise),
        current_discount_pct=quote.discount_pct,
        active_participants=active_count,
        spots_remaining=max(0, camp.max_participants - active_count),
    )

    return ResidentBookingDetail(
        id=booking.id,
        camp_id=booking.camp_id,
        resident_id=booking.resident_id,
        status=booking.status,
        quoted_price_paise=booking.quoted_price_paise,
        quoted_price_rupees=_paise_to_rupees(booking.quoted_price_paise),
        final_price_paise=booking.final_price_paise,
        final_price_rupees=_paise_to_rupees(booking.final_price_paise) if booking.final_price_paise is not None else None,
        slot_starts_at=booking.slot_starts_at,
        created_at=booking.created_at,
        cancelled_at=booking.cancelled_at,
        camp=camp_summary,
    )
