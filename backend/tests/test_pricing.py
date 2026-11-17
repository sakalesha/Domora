from __future__ import annotations

import pytest

from app.services.pricing import (
    InvalidTierError,
    NextTierInfo,
    PriceTier,
    PricingError,
    PricingQuote,
    calculate_discount_pct,
    calculate_discounted_price_paise,
    calculate_next_tier,
    calculate_pricing_quote,
    validate_price_tiers,
)

DEMO_TIERS = (
    PriceTier(min_participants=3, discount_pct=10),
    PriceTier(min_participants=6, discount_pct=15),
    PriceTier(min_participants=10, discount_pct=20),
)
DEMO_BASE_PRICE_PAISE = 80_000  # Rs 800.00


# ---------------------------------------------------------------------------
# 1. Hand-Calculated Demo Numbers & Boundary Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("headcount", "expected_discount", "expected_price_paise", "expected_next"),
    [
        (0, 0, 80_000, NextTierInfo(more_needed=3, target_participants=3, discount_pct=10)),
        (1, 0, 80_000, NextTierInfo(more_needed=2, target_participants=3, discount_pct=10)),
        (2, 0, 80_000, NextTierInfo(more_needed=1, target_participants=3, discount_pct=10)),
        (3, 10, 72_000, NextTierInfo(more_needed=3, target_participants=6, discount_pct=15)),
        (4, 10, 72_000, NextTierInfo(more_needed=2, target_participants=6, discount_pct=15)),
        (5, 10, 72_000, NextTierInfo(more_needed=1, target_participants=6, discount_pct=15)),
        (6, 15, 68_000, NextTierInfo(more_needed=4, target_participants=10, discount_pct=20)),
        (7, 15, 68_000, NextTierInfo(more_needed=3, target_participants=10, discount_pct=20)),
        (8, 15, 68_000, NextTierInfo(more_needed=2, target_participants=10, discount_pct=20)),
        (9, 15, 68_000, NextTierInfo(more_needed=1, target_participants=10, discount_pct=20)),
        (10, 20, 64_000, None),
        (11, 20, 64_000, None),
        (12, 20, 64_000, None),
        (100, 20, 64_000, None),
    ],
)
def test_demo_pricing_and_next_tier_calculations(
    headcount: int,
    expected_discount: int,
    expected_price_paise: int,
    expected_next: NextTierInfo | None,
):
    discount = calculate_discount_pct(headcount, DEMO_TIERS)
    assert discount == expected_discount

    price = calculate_discounted_price_paise(DEMO_BASE_PRICE_PAISE, discount)
    assert price == expected_price_paise

    next_tier = calculate_next_tier(headcount, DEMO_TIERS)
    assert next_tier == expected_next

    quote = calculate_pricing_quote(DEMO_BASE_PRICE_PAISE, headcount, DEMO_TIERS)
    assert quote == PricingQuote(
        base_price_paise=DEMO_BASE_PRICE_PAISE,
        headcount=headcount,
        discount_pct=expected_discount,
        final_price_paise=expected_price_paise,
        next_tier=expected_next,
    )


# ---------------------------------------------------------------------------
# 2. Rounding Half-Up Precision Tests (Integer Paise)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("base_paise", "discount_pct", "expected_paise"),
    [
        # Exact values:
        (10_000, 10, 9_000),      # Rs 100 @ 10% = Rs 90
        (49_900, 15, 42_415),     # Rs 499 @ 15% -> 49900 * 0.85 = 42415
        (80_500, 17, 66_815),     # Rs 805 @ 17% -> 80500 * 0.83 = 66815
        # Round half-up boundary tests (.5 paise rounds up to next whole paise):
        # 105 paise @ 10% -> 105 * 0.9 = 94.5 -> 95 paise
        (105, 10, 95),
        # 101 paise @ 10% -> 101 * 0.9 = 90.9 -> 91 paise
        (101, 10, 91),
        # 103 paise @ 10% -> 103 * 0.9 = 92.7 -> 93 paise
        (103, 10, 93),
        # 100% discount -> 0 paise
        (50_000, 100, 0),
        # 0% discount -> full price
        (50_000, 0, 50_000),
        # Zero base price -> 0 paise
        (0, 20, 0),
    ],
)
def test_discounted_price_round_half_up(base_paise: int, discount_pct: int, expected_paise: int):
    result = calculate_discounted_price_paise(base_paise, discount_pct)
    assert result == expected_paise
    assert isinstance(result, int)


# ---------------------------------------------------------------------------
# 3. Negative & Boundary Inputs for Calculation Functions
# ---------------------------------------------------------------------------

def test_negative_headcount_raises_error():
    with pytest.raises(PricingError, match="Headcount cannot be negative"):
        calculate_discount_pct(-1, DEMO_TIERS)

    with pytest.raises(PricingError, match="Headcount cannot be negative"):
        calculate_next_tier(-1, DEMO_TIERS)

    with pytest.raises(PricingError, match="Headcount cannot be negative"):
        calculate_pricing_quote(80_000, -1, DEMO_TIERS)


def test_negative_base_price_raises_error():
    with pytest.raises(PricingError, match="Base price cannot be negative"):
        calculate_discounted_price_paise(-100, 10)

    with pytest.raises(PricingError, match="Base price cannot be negative"):
        calculate_pricing_quote(-100, 3, DEMO_TIERS)


@pytest.mark.parametrize("invalid_discount", [-1, 101, 150])
def test_invalid_discount_percentage_raises_error(invalid_discount: int):
    with pytest.raises(PricingError, match="Discount percentage must be between 0 and 100"):
        calculate_discounted_price_paise(10_000, invalid_discount)


def test_empty_tiers_list():
    # If a camp has no tiers, discount is always 0% and next tier is None
    assert calculate_discount_pct(5, ()) == 0
    assert calculate_next_tier(5, ()) is None
    quote = calculate_pricing_quote(80_000, 5, ())
    assert quote.discount_pct == 0
    assert quote.final_price_paise == 80_000
    assert quote.next_tier is None


# ---------------------------------------------------------------------------
# 4. Tier List Validation Rules
# ---------------------------------------------------------------------------

def test_validate_valid_tiers_auto_sorts():
    unsorted = (
        PriceTier(min_participants=10, discount_pct=20),
        PriceTier(min_participants=3, discount_pct=10),
        PriceTier(min_participants=6, discount_pct=15),
    )
    validated = validate_price_tiers(unsorted)
    assert validated == (
        PriceTier(min_participants=3, discount_pct=10),
        PriceTier(min_participants=6, discount_pct=15),
        PriceTier(min_participants=10, discount_pct=20),
    )


def test_validate_duplicate_headcount_rejected():
    duplicate = (
        PriceTier(min_participants=3, discount_pct=10),
        PriceTier(min_participants=3, discount_pct=15),
    )
    with pytest.raises(InvalidTierError, match="Duplicate participant threshold"):
        validate_price_tiers(duplicate)


def test_validate_decreasing_discount_rejected():
    decreasing = (
        PriceTier(min_participants=3, discount_pct=15),
        PriceTier(min_participants=6, discount_pct=10),
    )
    with pytest.raises(InvalidTierError, match="Discounts must strictly increase"):
        validate_price_tiers(decreasing)


def test_validate_identical_discount_rejected():
    identical = (
        PriceTier(min_participants=3, discount_pct=10),
        PriceTier(min_participants=6, discount_pct=10),
    )
    with pytest.raises(InvalidTierError, match="Discounts must strictly increase"):
        validate_price_tiers(identical)


@pytest.mark.parametrize("invalid_min", [0, -1, -5])
def test_validate_non_positive_min_participants_rejected(invalid_min: int):
    tiers = (PriceTier(min_participants=invalid_min, discount_pct=10),)
    with pytest.raises(InvalidTierError, match="Minimum participants must be at least 1"):
        validate_price_tiers(tiers)


@pytest.mark.parametrize("invalid_pct", [-1, 101, 200])
def test_validate_out_of_range_discount_rejected(invalid_pct: int):
    tiers = (PriceTier(min_participants=3, discount_pct=invalid_pct),)
    with pytest.raises(InvalidTierError, match="Discount percentage must be between 0 and 100"):
        validate_price_tiers(tiers)
