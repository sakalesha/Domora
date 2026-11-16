from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.base import Base
from app.models.domain import Booking, Camp, CampPriceTier, JobRecord, Service, Society, User


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _make_society(session: Session, invite_code: str = "SUNRISE") -> Society:
    society = Society(
        name="Sunrise Heights",
        address="1 Main Road",
        city="Bengaluru",
        invite_code=invite_code,
    )
    session.add(society)
    session.commit()
    return society


def _make_service(session: Session, code: str = "pest_control") -> Service:
    service = Service(code=code, name="Pest Control")
    session.add(service)
    session.commit()
    return service


def _make_camp(session: Session, society: Society, service: Service) -> Camp:
    now = datetime.now(timezone.utc)
    camp = Camp(
        society_id=society.id,
        service_id=service.id,
        title="Pest Control Camp",
        starts_at=now + timedelta(days=2),
        ends_at=now + timedelta(days=2, hours=6),
        slot_minutes=30,
        min_participants=3,
        max_participants=10,
        join_deadline=now + timedelta(days=1),
        base_price_paise=80000,
        status="open",
    )
    session.add(camp)
    session.commit()
    return camp


def _make_user(session: Session, username: str, phone: str, role: str = "resident", society: Society | None = None) -> User:
    user = User(
        username=username,
        password_hash="hashed-password",
        full_name="Test User",
        phone=phone,
        role=role,
        society_id=society.id if society else None,
        unit_label="A-1" if role == "resident" else None,
    )
    session.add(user)
    session.commit()
    return user


def test_active_booking_unique_constraint(session: Session):
    society = _make_society(session)
    service = _make_service(session)
    camp = _make_camp(session, society, service)
    resident = _make_user(session, "resident1", "+919900000001", society=society)

    booking_1 = Booking(
        camp_id=camp.id,
        resident_id=resident.id,
        status="joined",
        quoted_price_paise=80000,
    )
    booking_2 = Booking(
        camp_id=camp.id,
        resident_id=resident.id,
        status="joined",
        quoted_price_paise=80000,
    )

    session.add(booking_1)
    session.commit()

    session.add(booking_2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_cancelled_booking_does_not_block_rejoining(session: Session):
    society = _make_society(session)
    service = _make_service(session)
    camp = _make_camp(session, society, service)
    resident = _make_user(session, "resident3", "+919900000005", society=society)

    session.add(
        Booking(
            camp_id=camp.id,
            resident_id=resident.id,
            status="joined",
            quoted_price_paise=80000,
        )
    )
    session.commit()
    session.query(Booking).filter_by(camp_id=camp.id, resident_id=resident.id).update(
        {"status": "cancelled"}
    )
    session.add(
        Booking(
            camp_id=camp.id,
            resident_id=resident.id,
            status="joined",
            quoted_price_paise=80000,
        )
    )
    session.commit()


def test_resident_requires_society_and_unit(session: Session):
    with pytest.raises(IntegrityError):
        user = User(
            username="bad-resident",
            password_hash="hashed-password",
            full_name="Bad Resident",
            phone="+919900000002",
            role="resident",
            society_id=None,
            unit_label=None,
        )
        session.add(user)
        session.commit()


@pytest.mark.parametrize(
    "field,value",
    [
        ("min_participants", 0),
        ("max_participants", 2),
        ("slot_minutes", 0),
        ("base_price_paise", -1),
        ("ends_at", datetime(2026, 1, 1, tzinfo=timezone.utc)),
    ],
)
def test_invalid_camp_values_are_rejected(session: Session, field: str, value):
    society = _make_society(session)
    service = _make_service(session)
    now = datetime.now(timezone.utc)
    values = {
        "society_id": society.id,
        "service_id": service.id,
        "title": "Invalid Camp",
        "starts_at": now + timedelta(days=2),
        "ends_at": now + timedelta(days=2, hours=6),
        "slot_minutes": 30,
        "min_participants": 3,
        "max_participants": 10,
        "join_deadline": now + timedelta(days=1),
        "base_price_paise": 80000,
        "status": "open",
    }
    values[field] = value
    session.add(Camp(**values))

    with pytest.raises(IntegrityError):
        session.commit()


def test_join_deadline_after_camp_start_is_rejected(session: Session):
    society = _make_society(session)
    service = _make_service(session)
    now = datetime.now(timezone.utc)
    camp = Camp(
        society_id=society.id,
        service_id=service.id,
        title="Invalid Deadline Camp",
        starts_at=now + timedelta(days=2),
        ends_at=now + timedelta(days=2, hours=6),
        slot_minutes=30,
        min_participants=3,
        max_participants=10,
        join_deadline=now + timedelta(days=3),
        base_price_paise=80000,
        status="open",
    )
    session.add(camp)

    with pytest.raises(IntegrityError):
        session.commit()


def test_price_tier_discount_range_is_enforced(session: Session):
    society = _make_society(session)
    service = _make_service(session)
    camp = _make_camp(session, society, service)
    session.add(CampPriceTier(camp_id=camp.id, min_participants=3, discount_pct=101))

    with pytest.raises(IntegrityError):
        session.commit()


def test_after_photo_requires_before_photo(session: Session):
    society = _make_society(session)
    service = _make_service(session)
    camp = _make_camp(session, society, service)
    vendor = _make_user(session, "vendor1", "+919900000003", role="vendor")
    resident = _make_user(session, "resident2", "+919900000004", society=society)

    booking = Booking(
        camp_id=camp.id,
        resident_id=resident.id,
        status="scheduled",
        quoted_price_paise=80000,
    )
    session.add(booking)
    session.commit()

    job = JobRecord(
        booking_id=booking.id,
        vendor_id=vendor.id,
        before_photo_path=None,
        after_photo_path="after.jpg",
    )
    session.add(job)
    with pytest.raises(IntegrityError):
        session.commit()
