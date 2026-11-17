from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class OpsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PriceTierInput(OpsRequest):
    min_participants: Annotated[int, Field(ge=1, description="Minimum participants required to unlock tier")]
    discount_pct: Annotated[int, Field(ge=0, le=100, description="Percentage discount offered at this tier")]


class CampCreateRequest(OpsRequest):
    society_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    service_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    starts_at: datetime
    ends_at: datetime
    slot_minutes: Annotated[int, Field(gt=0, description="Duration in minutes of each visit slot")]
    min_participants: Annotated[int, Field(ge=1, description="Minimum participants required for camp confirmation")]
    max_participants: Annotated[int, Field(ge=1, description="Maximum participants camp can accept")]
    join_deadline: datetime
    base_price_paise: Annotated[int, Field(ge=0, description="Base service price in integer paise")]
    vendor_id: str | None = None
    price_tiers: list[PriceTierInput] = Field(default_factory=list)


class CampAssignVendorRequest(OpsRequest):
    vendor_id: str | None = None


class PriceTierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    min_participants: int
    discount_pct: int


class SocietyReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    city: str
    address: str
    invite_code: str


class ServiceReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str


class VendorReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    phone: str


class NextTierResponse(BaseModel):
    min_participants: int
    discount_pct: int
    participants_needed: int
    potential_price_paise: int


class PricingQuoteResponse(BaseModel):
    headcount: int
    base_price_paise: int
    discount_pct: int
    discounted_price_paise: int
    next_tier: NextTierResponse | None = None


class ParticipantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    booking_id: str
    resident_id: str
    full_name: str
    unit_label: str | None
    phone: str
    status: str
    quoted_price_paise: int
    final_price_paise: int | None
    slot_starts_at: datetime | None
    created_at: datetime


class CampListItemResponse(BaseModel):
    id: str
    society: SocietyReferenceResponse
    service: ServiceReferenceResponse
    vendor: VendorReferenceResponse | None = None
    title: str
    starts_at: datetime
    ends_at: datetime
    slot_minutes: int
    status: str
    min_participants: int
    max_participants: int
    capacity_slots: int
    active_participants_count: int
    spots_remaining: int
    base_price_paise: int
    current_price_paise: int
    join_deadline: datetime
    created_at: datetime


class CampDetailResponse(BaseModel):
    id: str
    society: SocietyReferenceResponse
    service: ServiceReferenceResponse
    vendor: VendorReferenceResponse | None = None
    title: str
    starts_at: datetime
    ends_at: datetime
    slot_minutes: int
    status: str
    min_participants: int
    max_participants: int
    capacity_slots: int
    base_price_paise: int
    join_deadline: datetime
    cancelled_reason: str | None = None
    created_at: datetime
    price_tiers: list[PriceTierResponse]
    pricing_quote: PricingQuoteResponse
    participants: list[ParticipantSummary]
