from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    FetchedValue,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.service import Service
    from app.models.society import Society
    from app.models.user import User


class Camp(Base):
    __tablename__ = "camps"

    __table_args__ = (
        CheckConstraint("min_participants >= 1", name="camp_min_participants_check"),
        CheckConstraint("max_participants >= min_participants", name="camp_max_participants_check"),
        CheckConstraint("slot_minutes > 0", name="camp_slot_minutes_check"),
        CheckConstraint("base_price_paise >= 0", name="camp_base_price_paise_check"),
        CheckConstraint("starts_at < ends_at", name="camp_window_check"),
        CheckConstraint("join_deadline < starts_at", name="camp_join_deadline_check"),
        CheckConstraint(
            "status IN ('open', 'confirmed', 'in_progress', 'completed', 'cancelled')",
            name="camp_status_check",
        ),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("societies.id"), nullable=False)
    service_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("services.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    min_participants: Mapped[int] = mapped_column(Integer, nullable=False)
    max_participants: Mapped[int] = mapped_column(Integer, nullable=False)
    join_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    base_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    vendor_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_by: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("users.id"), nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=FetchedValue(),
        nullable=False,
    )

    society: Mapped["Society"] = relationship(back_populates="camps")
    service: Mapped["Service"] = relationship(back_populates="camps")
    vendor: Mapped["User | None"] = relationship(back_populates="assigned_camps", foreign_keys=[vendor_id])
    creator: Mapped["User | None"] = relationship(back_populates="created_camps", foreign_keys=[created_by])
    price_tiers: Mapped[list["CampPriceTier"]] = relationship(back_populates="camp", cascade="all, delete-orphan")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="camp", cascade="all, delete-orphan")


class CampPriceTier(Base):
    __tablename__ = "camp_price_tiers"

    __table_args__ = (
        CheckConstraint("discount_pct >= 0 AND discount_pct <= 100", name="camp_price_tier_discount_range_check"),
    )

    camp_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("camps.id"), primary_key=True)
    min_participants: Mapped[int] = mapped_column(Integer, primary_key=True)
    discount_pct: Mapped[int] = mapped_column(Integer, nullable=False)

    camp: Mapped[Camp] = relationship(back_populates="price_tiers")
