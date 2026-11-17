from __future__ import annotations

from datetime import datetime, timedelta


class CampRuleValidationError(ValueError):
    """Raised when camp schedule, capacity, or configuration parameters violate domain rules."""


def _ensure_timezone_aware(*datetimes: datetime) -> None:
    for dt in datetimes:
        if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
            raise CampRuleValidationError(
                f"Datetime must be timezone-aware (got {dt})"
            )


def calculate_capacity_slots(
    starts_at: datetime,
    ends_at: datetime,
    slot_minutes: int,
) -> int:
    """
    Computes the total number of whole service visit slots that can fit within a camp window.
    Any leftover minutes that do not fit a complete slot are discarded.
    """
    _ensure_timezone_aware(starts_at, ends_at)

    if starts_at >= ends_at:
        raise CampRuleValidationError(
            f"starts_at must be strictly before ends_at ({starts_at} >= {ends_at})"
        )
    if slot_minutes <= 0:
        raise CampRuleValidationError(
            f"slot_minutes must be greater than 0, got {slot_minutes}"
        )

    duration_seconds = (ends_at - starts_at).total_seconds()
    duration_minutes = int(duration_seconds // 60)
    return duration_minutes // slot_minutes


def validate_camp_parameters(
    *,
    starts_at: datetime,
    ends_at: datetime,
    slot_minutes: int,
    min_participants: int,
    max_participants: int,
    join_deadline: datetime,
    base_price_paise: int,
) -> int:
    """
    Validates camp scheduling, capacity, and pricing constraints according to domain rules.

    Rules:
    1. All datetimes must be timezone-aware.
    2. starts_at must be strictly before ends_at.
    3. slot_minutes must be > 0.
    4. min_participants must be >= 1.
    5. max_participants must be >= min_participants.
    6. max_participants must not exceed whole slot capacity of the window.
    7. join_deadline must be at least 24 hours prior to starts_at.
    8. base_price_paise must be >= 0.

    Returns:
        The calculated whole slot capacity for the camp window.
    """
    _ensure_timezone_aware(starts_at, ends_at, join_deadline)

    if starts_at >= ends_at:
        raise CampRuleValidationError(
            f"starts_at must be strictly before ends_at ({starts_at} >= {ends_at})"
        )
    if slot_minutes <= 0:
        raise CampRuleValidationError(
            f"slot_minutes must be greater than 0, got {slot_minutes}"
        )
    if base_price_paise < 0:
        raise CampRuleValidationError(
            f"base_price_paise cannot be negative, got {base_price_paise}"
        )
    if min_participants < 1:
        raise CampRuleValidationError(
            f"min_participants must be at least 1, got {min_participants}"
        )
    if max_participants < min_participants:
        raise CampRuleValidationError(
            "max_participants must be greater than or equal to min_participants "
            f"({max_participants} < {min_participants})"
        )

    capacity_slots = calculate_capacity_slots(starts_at, ends_at, slot_minutes)

    if max_participants > capacity_slots:
        raise CampRuleValidationError(
            f"max_participants ({max_participants}) cannot exceed capacity "
            f"({capacity_slots} slots available in window)"
        )

    min_required_deadline = starts_at - timedelta(hours=24)
    if join_deadline > min_required_deadline:
        raise CampRuleValidationError(
            "join_deadline must be at least 24 hours before starts_at "
            f"(latest allowed: {min_required_deadline}, got: {join_deadline})"
        )

    return capacity_slots
