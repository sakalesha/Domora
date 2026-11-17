from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.user import User


class JobRecord(Base):
    __tablename__ = "job_records"

    __table_args__ = (
        CheckConstraint("after_photo_path IS NULL OR before_photo_path IS NOT NULL", name="job_before_photo_required_for_after_check"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("bookings.id"), unique=True, nullable=False)
    vendor_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("users.id"), nullable=False)
    before_photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    booking: Mapped["Booking"] = relationship(back_populates="job_record")
    vendor: Mapped["User"] = relationship(back_populates="job_records")
