from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.ops_schemas import (
    CampCreateRequest,
    CampDetailResponse,
    CampListItemResponse,
    NextTierResponse,
    ParticipantSummary,
    PriceTierResponse,
    PricingQuoteResponse,
    ServiceReferenceResponse,
    SocietyReferenceResponse,
    VendorReferenceResponse,
)
from app.models.domain import Booking, Camp, CampPriceTier, Service, Society, User
from app.services.camp_rules import (
    CampRuleValidationError,
    calculate_capacity_slots,
    validate_camp_parameters,
)
from app.services.pricing import (
    PriceTier,
    PricingError,
    calculate_discount_pct,
    calculate_discounted_price_paise,
    calculate_pricing_quote,
    validate_price_tiers,
)


class CampOpsError(Exception):
    """Base exception for camp operations errors."""


class CampNotFoundError(CampOpsError):
    """Raised when a camp with the given ID cannot be found."""


class SocietyNotFoundError(CampOpsError):
    """Raised when the referenced society does not exist."""


class ServiceNotFoundError(CampOpsError):
    """Raised when the referenced service does not exist."""


class VendorNotFoundError(CampOpsError):
    """Raised when the referenced vendor does not exist or is invalid."""


class InvalidCampParameterError(CampOpsError):
    """Raised when domain validation rejects camp parameters or tiers."""


class InvalidCampStateError(CampOpsError):
    """Raised when an operation cannot be performed in the current camp state."""


def _to_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware and normalized to UTC."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def create_camp(session: Session, creator_id: str, data: CampCreateRequest) -> Camp:
    """Create a new camp with pricing tiers in a single transaction after full validation."""
    # 1. Validate camp scheduling & capacity parameters using Phase 3 pure rules
    try:
        validate_camp_parameters(
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            slot_minutes=data.slot_minutes,
            min_participants=data.min_participants,
            max_participants=data.max_participants,
            join_deadline=data.join_deadline,
            base_price_paise=data.base_price_paise,
        )
    except CampRuleValidationError as exc:
        raise InvalidCampParameterError(str(exc)) from exc

    # 2. Validate price tiers using Phase 3 pure pricing engine
    domain_tiers = [
        PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
        for t in data.price_tiers
    ]
    try:
        validate_price_tiers(domain_tiers)
    except PricingError as exc:
        raise InvalidCampParameterError(str(exc)) from exc

    # Ensure tier thresholds do not exceed camp capacity ceiling
    for tier in domain_tiers:
        if tier.min_participants > data.max_participants:
            raise InvalidCampParameterError(
                f"Price tier min_participants ({tier.min_participants}) cannot exceed max_participants ({data.max_participants})"
            )

    # 3. Verify referenced society exists
    society = session.get(Society, data.society_id)
    if society is None:
        raise SocietyNotFoundError(f"Society '{data.society_id}' does not exist")

    # 4. Verify referenced service exists
    service = session.get(Service, data.service_id)
    if service is None:
        raise ServiceNotFoundError(f"Service '{data.service_id}' does not exist")

    # 5. Verify vendor if assigned
    if data.vendor_id is not None:
        vendor = session.get(User, data.vendor_id)
        if vendor is None or vendor.role != "vendor" or not vendor.is_active:
            raise VendorNotFoundError(f"Vendor '{data.vendor_id}' is invalid or inactive")

    # 6. Persist Camp & CampPriceTiers atomically
    camp = Camp(
        society_id=data.society_id,
        service_id=data.service_id,
        title=data.title,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        slot_minutes=data.slot_minutes,
        min_participants=data.min_participants,
        max_participants=data.max_participants,
        join_deadline=data.join_deadline,
        base_price_paise=data.base_price_paise,
        vendor_id=data.vendor_id,
        created_by=creator_id,
        status="open",
    )
    session.add(camp)
    session.flush()

    for tier in domain_tiers:
        camp_tier = CampPriceTier(
            camp_id=camp.id,
            min_participants=tier.min_participants,
            discount_pct=tier.discount_pct,
        )
        session.add(camp_tier)

    session.commit()

    # Re-fetch camp with eager relationships for clean response building
    return get_camp_or_raise(session, camp.id)


def get_camp_or_raise(session: Session, camp_id: str) -> Camp:
    """Fetch a Camp by ID with related society, service, vendor, and price_tiers loaded."""
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
    camp = session.scalar(stmt)
    if camp is None:
        raise CampNotFoundError(f"Camp '{camp_id}' not found")
    return camp


def list_camps(
    session: Session,
    society_id: str | None = None,
    status_filter: str | None = None,
) -> list[CampListItemResponse]:
    """List camps with aggregated active booking counts, spots remaining, and current prices."""
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
    if status_filter:
        stmt = stmt.where(Camp.status == status_filter)

    camps = session.scalars(stmt).unique().all()
    results: list[CampListItemResponse] = []

    for camp in camps:
        active_count = sum(1 for b in camp.bookings if b.status != "cancelled")
        capacity_slots = calculate_capacity_slots(_to_utc(camp.starts_at), _to_utc(camp.ends_at), camp.slot_minutes)
        spots_remaining = max(0, camp.max_participants - active_count)

        domain_tiers = [
            PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
            for t in camp.price_tiers
        ]
        discount_pct = calculate_discount_pct(active_count, domain_tiers)
        current_price = calculate_discounted_price_paise(camp.base_price_paise, discount_pct)

        vendor_ref = None
        if camp.vendor is not None:
            vendor_ref = VendorReferenceResponse.model_validate(camp.vendor)

        results.append(
            CampListItemResponse(
                id=camp.id,
                society=SocietyReferenceResponse.model_validate(camp.society),
                service=ServiceReferenceResponse.model_validate(camp.service),
                vendor=vendor_ref,
                title=camp.title,
                starts_at=camp.starts_at,
                ends_at=camp.ends_at,
                slot_minutes=camp.slot_minutes,
                status=camp.status,
                min_participants=camp.min_participants,
                max_participants=camp.max_participants,
                capacity_slots=capacity_slots,
                active_participants_count=active_count,
                spots_remaining=spots_remaining,
                base_price_paise=camp.base_price_paise,
                current_price_paise=current_price,
                join_deadline=camp.join_deadline,
                created_at=camp.created_at,
            )
        )

    return results


def get_camp_detail(session: Session, camp_id: str) -> CampDetailResponse:
    """Fetch complete camp detail including sorted tiers, dynamic pricing quote, and participants roster."""
    camp = get_camp_or_raise(session, camp_id)

    # Sort price tiers ascending by min_participants
    sorted_tiers = sorted(camp.price_tiers, key=lambda t: t.min_participants)
    domain_tiers = [
        PriceTier(min_participants=t.min_participants, discount_pct=t.discount_pct)
        for t in sorted_tiers
    ]

    # Filter active bookings for participants list and quote calculation
    active_bookings = [b for b in camp.bookings if b.status != "cancelled"]
    active_count = len(active_bookings)
    capacity_slots = calculate_capacity_slots(_to_utc(camp.starts_at), _to_utc(camp.ends_at), camp.slot_minutes)

    # Calculate live pricing quote
    quote = calculate_pricing_quote(camp.base_price_paise, active_count, domain_tiers)
    next_tier_resp = None
    if quote.next_tier is not None:
        potential_price = calculate_discounted_price_paise(
            camp.base_price_paise,
            quote.next_tier.discount_pct,
        )
        next_tier_resp = NextTierResponse(
            min_participants=quote.next_tier.target_participants,
            discount_pct=quote.next_tier.discount_pct,
            participants_needed=quote.next_tier.more_needed,
            potential_price_paise=potential_price,
        )

    quote_resp = PricingQuoteResponse(
        headcount=quote.headcount,
        base_price_paise=quote.base_price_paise,
        discount_pct=quote.discount_pct,
        discounted_price_paise=quote.final_price_paise,
        next_tier=next_tier_resp,
    )

    # Build participant summaries in join order (created_at asc)
    participants: list[ParticipantSummary] = [
        ParticipantSummary(
            booking_id=b.id,
            resident_id=b.resident_id,
            full_name=b.resident.full_name,
            unit_label=b.resident.unit_label,
            phone=b.resident.phone,
            status=b.status,
            quoted_price_paise=b.quoted_price_paise,
            final_price_paise=b.final_price_paise,
            slot_starts_at=b.slot_starts_at,
            created_at=b.created_at,
        )
        for b in sorted(active_bookings, key=lambda b: b.created_at)
    ]

    vendor_ref = None
    if camp.vendor is not None:
        vendor_ref = VendorReferenceResponse.model_validate(camp.vendor)

    return CampDetailResponse(
        id=camp.id,
        society=SocietyReferenceResponse.model_validate(camp.society),
        service=ServiceReferenceResponse.model_validate(camp.service),
        vendor=vendor_ref,
        title=camp.title,
        starts_at=camp.starts_at,
        ends_at=camp.ends_at,
        slot_minutes=camp.slot_minutes,
        status=camp.status,
        min_participants=camp.min_participants,
        max_participants=camp.max_participants,
        capacity_slots=capacity_slots,
        base_price_paise=camp.base_price_paise,
        join_deadline=camp.join_deadline,
        cancelled_reason=camp.cancelled_reason,
        created_at=camp.created_at,
        price_tiers=[PriceTierResponse.model_validate(t) for t in sorted_tiers],
        pricing_quote=quote_resp,
        participants=participants,
    )


def assign_vendor(session: Session, camp_id: str, vendor_id: str | None) -> Camp:
    """Assign or reassign a vendor to a camp in open or confirmed state."""
    camp = get_camp_or_raise(session, camp_id)

    if camp.status in {"completed", "cancelled"}:
        raise InvalidCampStateError(f"Cannot assign vendor to camp with status '{camp.status}'")

    if vendor_id is not None:
        vendor = session.get(User, vendor_id)
        if vendor is None or vendor.role != "vendor" or not vendor.is_active:
            raise VendorNotFoundError(f"Vendor '{vendor_id}' is invalid or inactive")

    camp.vendor_id = vendor_id
    session.commit()
    session.refresh(camp)
    return camp


def list_societies(session: Session) -> list[Society]:
    """List societies sorted by name for ops selection."""
    return list(session.scalars(select(Society).order_by(Society.name.asc())).all())


def list_services(session: Session) -> list[Service]:
    """List service catalog items for ops selection."""
    return list(session.scalars(select(Service).order_by(Service.name.asc())).all())


def list_active_vendors(session: Session) -> list[User]:
    """List active vendors for camp assignment."""
    stmt = (
        select(User)
        .where(User.role == "vendor", User.is_active == True)
        .order_by(User.full_name.asc())
    )
    return list(session.scalars(stmt).all())
