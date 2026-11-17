from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


class PricingError(ValueError):
    """Raised when an invalid monetary or headcount input is supplied."""


class InvalidTierError(PricingError):
    """Raised when a price tier configuration is structurally or logically invalid."""


@dataclass(frozen=True)
class PriceTier:
    """Represents a volume discount tier."""
    min_participants: int
    discount_pct: int


@dataclass(frozen=True)
class NextTierInfo:
    """Information on what is required to reach the subsequent discount tier."""
    more_needed: int
    target_participants: int
    discount_pct: int


@dataclass(frozen=True)
class PricingQuote:
    """Complete pricing snapshot for a camp at a specific headcount."""
    base_price_paise: int
    headcount: int
    discount_pct: int
    final_price_paise: int
    next_tier: NextTierInfo | None


def validate_price_tiers(tiers: Sequence[PriceTier]) -> tuple[PriceTier, ...]:
    """
    Validates and returns price tiers sorted ascending by min_participants.

    Rules:
    - min_participants must be >= 1
    - discount_pct must be between 0 and 100
    - min_participants must be unique (no duplicate thresholds)
    - discount_pct must strictly increase as min_participants grows
    """
    if not tiers:
        return ()

    for tier in tiers:
        if tier.min_participants < 1:
            raise InvalidTierError(
                f"Minimum participants must be at least 1, got {tier.min_participants}"
            )
        if not (0 <= tier.discount_pct <= 100):
            raise InvalidTierError(
                f"Discount percentage must be between 0 and 100, got {tier.discount_pct}"
            )

    sorted_tiers = sorted(tiers, key=lambda t: t.min_participants)

    for i in range(len(sorted_tiers) - 1):
        current_tier = sorted_tiers[i]
        next_tier = sorted_tiers[i + 1]

        if current_tier.min_participants == next_tier.min_participants:
            raise InvalidTierError(
                f"Duplicate participant threshold: {current_tier.min_participants}"
            )
        if next_tier.discount_pct <= current_tier.discount_pct:
            raise InvalidTierError(
                "Discounts must strictly increase as participant thresholds grow "
                f"({current_tier.discount_pct}% at {current_tier.min_participants} vs "
                f"{next_tier.discount_pct}% at {next_tier.min_participants})"
            )

    return tuple(sorted_tiers)


def calculate_discount_pct(headcount: int, tiers: Sequence[PriceTier]) -> int:
    """
    Returns the percentage discount earned for a given participant headcount.
    Below the lowest tier threshold, returns 0.
    """
    if headcount < 0:
        raise PricingError("Headcount cannot be negative")

    valid_tiers = validate_price_tiers(tiers)
    discount = 0

    for tier in valid_tiers:
        if headcount >= tier.min_participants:
            discount = tier.discount_pct
        else:
            break

    return discount


def calculate_discounted_price_paise(base_price_paise: int, discount_pct: int) -> int:
    """
    Calculates the discounted price in integer paise using standard round-half-up.
    Guarantees no floating-point inaccuracies.
    """
    if base_price_paise < 0:
        raise PricingError("Base price cannot be negative")
    if not (0 <= discount_pct <= 100):
        raise PricingError("Discount percentage must be between 0 and 100")

    if discount_pct == 0:
        return base_price_paise
    if discount_pct == 100:
        return 0

    multiplier = Decimal(100 - discount_pct) / Decimal(100)
    discounted = (Decimal(base_price_paise) * multiplier).quantize(
        Decimal("1"),
        rounding=ROUND_HALF_UP,
    )
    return int(discounted)


def calculate_next_tier(headcount: int, tiers: Sequence[PriceTier]) -> NextTierInfo | None:
    """
    Computes how many more participants are needed to unlock the next discount tier.
    Returns None if the highest tier has already been reached or no tiers exist.
    """
    if headcount < 0:
        raise PricingError("Headcount cannot be negative")

    valid_tiers = validate_price_tiers(tiers)

    for tier in valid_tiers:
        if tier.min_participants > headcount:
            return NextTierInfo(
                more_needed=tier.min_participants - headcount,
                target_participants=tier.min_participants,
                discount_pct=tier.discount_pct,
            )

    return None


def calculate_pricing_quote(
    base_price_paise: int,
    headcount: int,
    tiers: Sequence[PriceTier],
) -> PricingQuote:
    """
    Computes a complete PricingQuote snapshot for a camp at a given headcount.
    """
    if base_price_paise < 0:
        raise PricingError("Base price cannot be negative")
    if headcount < 0:
        raise PricingError("Headcount cannot be negative")

    discount_pct = calculate_discount_pct(headcount, tiers)
    final_price_paise = calculate_discounted_price_paise(base_price_paise, discount_pct)
    next_tier = calculate_next_tier(headcount, tiers)

    return PricingQuote(
        base_price_paise=base_price_paise,
        headcount=headcount,
        discount_pct=discount_pct,
        final_price_paise=final_price_paise,
        next_tier=next_tier,
    )
