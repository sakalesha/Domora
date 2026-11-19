from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ResidentSocietySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    name: str
    city: str


class ResidentServiceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    name: str
    description: str | None = None
    unit_label: str | None = None


class ResidentNextTier(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    more_needed: int = Field(..., ge=1, description="Number of additional neighbours needed to unlock tier")
    target_participants: int = Field(..., ge=1, description="Target headcount threshold")
    discount_pct: int = Field(..., ge=0, le=100, description="Discount percentage at target tier")
    target_price_paise: int = Field(..., ge=0, description="Projected price in paise at target tier")
    target_price_rupees: float = Field(..., ge=0.0, description="Projected price in rupees at target tier")


class ResidentBookingSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    status: str
    quoted_price_paise: int
    quoted_price_rupees: float
    final_price_paise: int | None = None
    final_price_rupees: float | None = None
    slot_starts_at: datetime | None = None


class ResidentTierItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    min_participants: int = Field(..., ge=1)
    discount_pct: int = Field(..., ge=0, le=100)
    price_paise: int = Field(..., ge=0)
    price_rupees: float = Field(..., ge=0.0)
    status: str = Field(..., description="Status of tier: reached, current, next, or upcoming")


class ResidentCampListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    title: str
    status: str
    starts_at: datetime
    ends_at: datetime
    slot_minutes: int
    join_deadline: datetime
    base_price_paise: int
    base_price_rupees: float
    current_price_paise: int
    current_price_rupees: float
    discount_pct: int
    participants_count: int
    min_participants: int
    max_participants: int
    spots_remaining: int
    is_confirmed_or_higher: bool
    can_join: bool
    society: ResidentSocietySummary
    service: ResidentServiceSummary
    next_tier: ResidentNextTier | None = None
    user_booking: ResidentBookingSummary | None = None


class ResidentCampDetail(ResidentCampListItem):
    tiers: list[ResidentTierItem]
    price_disclaimer: str = Field(
        default=(
            "Current price is provisional based on group participation and locks "
            "when the camp is confirmed. The price may adjust if neighbours join or leave "
            "before confirmation."
        ),
        description="Explicit notice regarding provisional open-camp pricing (Decision P1)",
    )
