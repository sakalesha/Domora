from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    FetchedValue,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.camp import Camp
    from app.models.job_record import JobRecord
    from app.models.user import User


class Booking(Base):
    __tablename__ = "bookings"

    __table_args__ = (
        Index(
            "uq_active_booking_per_camp_resident",
            "camp_id",
            "resident_id",
            unique=True,
            sqlite_where=text("status != 'cancelled'"),
            postgresql_where=text("status <> 'cancelled'"),
        ),
        CheckConstraint(
            "status IN ('joined', 'scheduled', 'in_progress', 'completed', 'cancelled')",
            name="booking_status_check",
        ),
        CheckConstraint("quoted_price_paise >= 0", name="booking_quoted_price_non_negative_check"),
        CheckConstraint("final_price_paise IS NULL OR final_price_paise >= 0", name="booking_final_price_non_negative_check"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    camp_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("camps.id"), nullable=False)
    resident_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="joined")
    quoted_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    final_price_paise: Mapped[int | None] = mapped_column(Integer, nullable=True)
    slot_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=FetchedValue(),
        nullable=False,
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    camp: Mapped["Camp"] = relationship(back_populates="bookings")
    resident: Mapped["User"] = relationship(back_populates="bookings")
    job_record: Mapped["JobRecord | None"] = relationship(back_populates="booking", uselist=False, cascade="all, delete-orphan")
