from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.ops import ParticipantSummary


class BookingCreateRequest(BaseModel):
    camp_id: str
    slot_starts_at: datetime | None = None


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    camp_id: str
    resident_id: str
    status: str
    quoted_price_paise: int
    final_price_paise: int | None = None
    slot_starts_at: datetime | None = None
    created_at: datetime
    cancelled_at: datetime | None = None


# Order aliases for group-buying bookings
OrderCreate = BookingCreateRequest
OrderResponse = BookingResponse

__all__ = [
    "BookingCreateRequest",
    "BookingResponse",
    "OrderCreate",
    "OrderResponse",
    "ParticipantSummary",
]
