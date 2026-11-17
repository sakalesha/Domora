from __future__ import annotations

# In Domora's group buying architecture, an Order is represented by a Booking.
from app.models.booking import Booking

Order = Booking

__all__ = ["Booking", "Order"]
