from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.services.camp_rules import (
    CampRuleValidationError,
    calculate_capacity_slots,
    validate_camp_parameters,
)

# Reference standard test times in UTC
WINDOW_START = datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 12, 1, 16, 0, tzinfo=timezone.utc)  # 6 hours = 360 mins
VALID_DEADLINE = datetime(2026, 11, 30, 10, 0, tzinfo=timezone.utc)  # exactly 24h before


# ---------------------------------------------------------------------------
# 1. Capacity & Slot Calculation Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("start", "end", "slot_minutes", "expected_slots"),
    [
        # 6 hours (360 min) with 30m slots -> 12 slots (Demo case)
        (WINDOW_START, WINDOW_END, 30, 12),
        # 6 hours (360 min) with 45m slots -> 8 slots
        (WINDOW_START, WINDOW_END, 45, 8),
        # 6 hours (360 min) with 60m slots -> 6 slots
        (WINDOW_START, WINDOW_END, 60, 6),
        # Partial slot truncation: 375 minutes with 30m slots -> 12 slots (extra 15m ignored)
        (WINDOW_START, WINDOW_START + timedelta(minutes=375), 30, 12),
        # Partial slot truncation: 389 minutes with 30m slots -> 12 slots (extra 29m ignored)
        (WINDOW_START, WINDOW_START + timedelta(minutes=389), 30, 12),
        # Window exactly one slot
        (WINDOW_START, WINDOW_START + timedelta(minutes=30), 30, 1),
        # Window shorter than slot duration -> 0 slots
        (WINDOW_START, WINDOW_START + timedelta(minutes=25), 30, 0),
    ],
)
def test_calculate_capacity_slots(
    start: datetime,
    end: datetime,
    slot_minutes: int,
    expected_slots: int,
):
    slots = calculate_capacity_slots(start, end, slot_minutes)
    assert slots == expected_slots
    assert isinstance(slots, int)


# ---------------------------------------------------------------------------
# 2. Valid Camp Parameters
# ---------------------------------------------------------------------------

def test_valid_camp_parameters_returns_capacity():
    capacity = validate_camp_parameters(
        starts_at=WINDOW_START,
        ends_at=WINDOW_END,
        slot_minutes=30,
        min_participants=3,
        max_participants=12,
        join_deadline=VALID_DEADLINE,
        base_price_paise=80_000,
    )
    assert capacity == 12


def test_valid_camp_with_earlier_deadline_and_smaller_max():
    # Deadline 48h before window, max participants 8 (less than 12 slots capacity)
    capacity = validate_camp_parameters(
        starts_at=WINDOW_START,
        ends_at=WINDOW_END,
        slot_minutes=30,
        min_participants=1,
        max_participants=8,
        join_deadline=WINDOW_START - timedelta(hours=48),
        base_price_paise=50_000,
    )
    assert capacity == 12


def test_valid_zero_base_price():
    # Free camps are allowed (base_price_paise = 0)
    capacity = validate_camp_parameters(
        starts_at=WINDOW_START,
        ends_at=WINDOW_END,
        slot_minutes=30,
        min_participants=1,
        max_participants=5,
        join_deadline=VALID_DEADLINE,
        base_price_paise=0,
    )
    assert capacity == 12


# ---------------------------------------------------------------------------
# 3. Window & Slot Errors
# ---------------------------------------------------------------------------

def test_rejects_end_before_start():
    with pytest.raises(CampRuleValidationError, match="starts_at must be strictly before ends_at"):
        validate_camp_parameters(
            starts_at=WINDOW_END,
            ends_at=WINDOW_START,
            slot_minutes=30,
            min_participants=1,
            max_participants=5,
            join_deadline=VALID_DEADLINE,
            base_price_paise=80_000,
        )


def test_rejects_start_equal_to_end():
    with pytest.raises(CampRuleValidationError, match="starts_at must be strictly before ends_at"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_START,
            slot_minutes=30,
            min_participants=1,
            max_participants=5,
            join_deadline=VALID_DEADLINE,
            base_price_paise=80_000,
        )


@pytest.mark.parametrize("invalid_slot", [0, -1, -30])
def test_rejects_non_positive_slot_minutes(invalid_slot: int):
    with pytest.raises(CampRuleValidationError, match="slot_minutes must be greater than 0"):
        calculate_capacity_slots(WINDOW_START, WINDOW_END, invalid_slot)

    with pytest.raises(CampRuleValidationError, match="slot_minutes must be greater than 0"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=invalid_slot,
            min_participants=1,
            max_participants=5,
            join_deadline=VALID_DEADLINE,
            base_price_paise=80_000,
        )


# ---------------------------------------------------------------------------
# 4. Capacity & Participant Bound Errors
# ---------------------------------------------------------------------------

def test_rejects_max_participants_exceeding_capacity():
    # Window has 12 slots, but max_participants is 13
    with pytest.raises(CampRuleValidationError, match="max_participants .* cannot exceed capacity"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=30,
            min_participants=3,
            max_participants=13,
            join_deadline=VALID_DEADLINE,
            base_price_paise=80_000,
        )


def test_rejects_min_participants_greater_than_max():
    with pytest.raises(CampRuleValidationError, match="max_participants must be greater than or equal to min_participants"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=30,
            min_participants=6,
            max_participants=5,
            join_deadline=VALID_DEADLINE,
            base_price_paise=80_000,
        )


@pytest.mark.parametrize("invalid_min", [0, -1])
def test_rejects_non_positive_min_participants(invalid_min: int):
    with pytest.raises(CampRuleValidationError, match="min_participants must be at least 1"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=30,
            min_participants=invalid_min,
            max_participants=5,
            join_deadline=VALID_DEADLINE,
            base_price_paise=80_000,
        )


def test_rejects_window_with_insufficient_slots_for_min():
    # 20 min window with 30 min slots -> 0 capacity
    short_end = WINDOW_START + timedelta(minutes=20)
    with pytest.raises(CampRuleValidationError, match="max_participants .* cannot exceed capacity"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=short_end,
            slot_minutes=30,
            min_participants=1,
            max_participants=1,
            join_deadline=WINDOW_START - timedelta(hours=25),
            base_price_paise=80_000,
        )


# ---------------------------------------------------------------------------
# 5. Join Deadline 24-Hour Buffer Validation
# ---------------------------------------------------------------------------

def test_rejects_deadline_less_than_24_hours_before_start():
    # 23 hours and 59 minutes before start
    late_deadline = WINDOW_START - timedelta(hours=23, minutes=59)
    with pytest.raises(CampRuleValidationError, match="join_deadline must be at least 24 hours before"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=30,
            min_participants=3,
            max_participants=10,
            join_deadline=late_deadline,
            base_price_paise=80_000,
        )


def test_rejects_deadline_after_or_equal_to_start():
    with pytest.raises(CampRuleValidationError, match="join_deadline must be at least 24 hours before"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=30,
            min_participants=3,
            max_participants=10,
            join_deadline=WINDOW_START,
            base_price_paise=80_000,
        )


# ---------------------------------------------------------------------------
# 6. Negative Price & Timezone Awareness Checks
# ---------------------------------------------------------------------------

def test_rejects_negative_base_price():
    with pytest.raises(CampRuleValidationError, match="base_price_paise cannot be negative"):
        validate_camp_parameters(
            starts_at=WINDOW_START,
            ends_at=WINDOW_END,
            slot_minutes=30,
            min_participants=3,
            max_participants=10,
            join_deadline=VALID_DEADLINE,
            base_price_paise=-500,
        )


def test_rejects_naive_datetimes():
    naive_start = datetime(2026, 12, 1, 10, 0)
    naive_end = datetime(2026, 12, 1, 16, 0)
    naive_deadline = datetime(2026, 11, 30, 10, 0)

    with pytest.raises(CampRuleValidationError, match="timezone-aware"):
        calculate_capacity_slots(naive_start, WINDOW_END, 30)

    with pytest.raises(CampRuleValidationError, match="timezone-aware"):
        validate_camp_parameters(
            starts_at=naive_start,
            ends_at=naive_end,
            slot_minutes=30,
            min_participants=3,
            max_participants=10,
            join_deadline=naive_deadline,
            base_price_paise=80_000,
        )
