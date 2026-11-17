from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    FetchedValue,
    ForeignKey,
    String,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.camp import Camp
    from app.models.job_record import JobRecord
    from app.models.society import Society


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint("role IN ('resident', 'vendor', 'ops')", name="users_role_check"),
        CheckConstraint(
            "(role = 'resident' AND society_id IS NOT NULL AND unit_label IS NOT NULL) OR role <> 'resident'",
            name="users_resident_requirements_check",
        ),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="resident")
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
    society_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("societies.id"), nullable=True)
    unit_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=FetchedValue(),
        nullable=False,
    )

    society: Mapped["Society | None"] = relationship(back_populates="users")
    created_camps: Mapped[list["Camp"]] = relationship(back_populates="creator", foreign_keys="Camp.created_by")
    assigned_camps: Mapped[list["Camp"]] = relationship(back_populates="vendor", foreign_keys="Camp.vendor_id")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="resident")
    job_records: Mapped[list["JobRecord"]] = relationship(back_populates="vendor")
