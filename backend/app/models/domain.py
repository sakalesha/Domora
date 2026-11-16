from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    FetchedValue,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Society(Base):
    __tablename__ = "societies"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=FetchedValue(),
        nullable=False,
    )

    users: Mapped[list["User"]] = relationship(back_populates="society")
    camps: Mapped[list["Camp"]] = relationship(back_populates="society")


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

    society: Mapped[Society | None] = relationship(back_populates="users")
    created_camps: Mapped[list["Camp"]] = relationship(back_populates="creator", foreign_keys="Camp.created_by")
    assigned_camps: Mapped[list["Camp"]] = relationship(back_populates="vendor", foreign_keys="Camp.vendor_id")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="resident")
    job_records: Mapped[list["JobRecord"]] = relationship(back_populates="vendor")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    camps: Mapped[list["Camp"]] = relationship(back_populates="service")


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

    society: Mapped[Society] = relationship(back_populates="camps")
    service: Mapped[Service] = relationship(back_populates="camps")
    vendor: Mapped[User | None] = relationship(back_populates="assigned_camps", foreign_keys=[vendor_id])
    creator: Mapped[User | None] = relationship(back_populates="created_camps", foreign_keys=[created_by])
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

    camp: Mapped[Camp] = relationship(back_populates="bookings")
    resident: Mapped[User] = relationship(back_populates="bookings")
    job_record: Mapped["JobRecord | None"] = relationship(back_populates="booking", uselist=False, cascade="all, delete-orphan")


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

    booking: Mapped[Booking] = relationship(back_populates="job_record")
    vendor: Mapped[User] = relationship(back_populates="job_records")
