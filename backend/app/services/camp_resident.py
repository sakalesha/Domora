from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.domain import Booking, Camp, CampPriceTier, User
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
