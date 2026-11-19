from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ResidentCampSummaryForBooking(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    title: str
    service_name: str
    status: str
    starts_at: datetime
    ends_at: datetime
    base_price_paise: int
    base_price_rupees: float
    current_provisional_price_paise: int
    current_provisional_price_rupees: float
    current_discount_pct: int
    active_participants: int
    spots_remaining: int


class ResidentBookingDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    camp_id: str
    resident_id: str
    status: str
    quoted_price_paise: int
    quoted_price_rupees: float
    final_price_paise: int | None = None
    final_price_rupees: float | None = None
    slot_starts_at: datetime | None = None
    created_at: datetime
    cancelled_at: datetime | None = None
    camp: ResidentCampSummaryForBooking


class ResidentBookingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    camp_id: str
    status: str
    quoted_price_paise: int
    quoted_price_rupees: float
    final_price_paise: int | None = None
    final_price_rupees: float | None = None
    slot_starts_at: datetime | None = None
    created_at: datetime
    cancelled_at: datetime | None = None
    camp_title: str
    service_name: str
    camp_status: str
    starts_at: datetime
    ends_at: datetime


class ResidentBookingLeaveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: str
    camp_id: str
    status: str
    cancelled_at: datetime


__all__ = [
    "ResidentBookingDetail",
    "ResidentBookingItem",
    "ResidentBookingLeaveResponse",
    "ResidentCampSummaryForBooking",
]
