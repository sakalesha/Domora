from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token
from app.models.domain import Booking, Camp, CampPriceTier, Service, Society, User
from app.services.auth import hash_password


def _create_user(
    db_session,
    *,
    username: str,
    role: str = "resident",
    is_active: bool = True,
    society_id: str | None = None,
    unit_label: str | None = None,
) -> User:
    if role == "resident":
        if unit_label is None:
            unit_label = f"Flat {uuid.uuid4().int % 900 + 100}"

    user = User(
        username=username,
        password_hash=hash_password("password123"),
        full_name=f"User {username}",
        phone=f"+91{uuid.uuid4().int % 10000000000:010d}",
        role=role,
        is_active=is_active,
        society_id=society_id,
        unit_label=unit_label,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_society(db_session, name: str = "Sunrise Heights") -> Society:
    soc = Society(
        name=name,
        address="123 Sarjapur Road",
        city="Bengaluru",
        invite_code=f"SOC-{uuid.uuid4().hex[:6].upper()}",
    )
    db_session.add(soc)
    db_session.commit()
    db_session.refresh(soc)
    return soc


def _create_service(db_session, code: str = "pest_control", name: str = "Pest Control") -> Service:
    srv = Service(code=code, name=name)
    db_session.add(srv)
    db_session.commit()
    db_session.refresh(srv)
    return srv


def _create_camp(
    db_session,
    society_id: str,
    service_id: str,
    *,
    base_price_paise: int = 80000,
    min_participants: int = 3,
    max_participants: int = 12,
    status: str = "open",
    hours_from_now: int = 72,
    join_deadline_hours: int = 24,
    tiers: list[tuple[int, int]] | None = None,
) -> Camp:
    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(hours=hours_from_now)
    ends_at = starts_at + timedelta(hours=6)
    join_deadline = starts_at - timedelta(hours=join_deadline_hours)

    camp = Camp(
        society_id=society_id,
        service_id=service_id,
        title="Society Pest Control Camp",
        starts_at=starts_at,
        ends_at=ends_at,
        slot_minutes=30,
        min_participants=min_participants,
        max_participants=max_participants,
        join_deadline=join_deadline,
        base_price_paise=base_price_paise,
        status=status,
    )
    db_session.add(camp)
    db_session.flush()

    if tiers is None:
        tiers = [(3, 10), (6, 15), (10, 20)]

    for min_p, discount in tiers:
        db_session.add(
            CampPriceTier(
                camp_id=camp.id,
                min_participants=min_p,
                discount_pct=discount,
            )
        )

    db_session.commit()
    db_session.refresh(camp)
    return camp


def _add_booking(
    db_session,
    camp_id: str,
    resident_id: str,
    status: str = "joined",
    quoted_price_paise: int = 80000,
) -> Booking:
    booking = Booking(
        camp_id=camp_id,
        resident_id=resident_id,
        status=status,
        quoted_price_paise=quoted_price_paise,
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


def _auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


class TestResidentCampAuthAndAccess:
    """Tests for authentication and role requirements."""

    def test_unauthenticated_request_rejected(self, client):
        res = client.get("/api/v1/resident/camps")
        assert res.status_code == 401

    def test_non_resident_role_rejected(self, client, db_session):
        ops_user = _create_user(db_session, username="ops_worker", role="ops")
        vendor_user = _create_user(db_session, username="vendor_tech", role="vendor")

        res_ops = client.get("/api/v1/resident/camps", headers=_auth_headers(ops_user))
        assert res_ops.status_code == 403

        res_vendor = client.get("/api/v1/resident/camps", headers=_auth_headers(vendor_user))
        assert res_vendor.status_code == 403

    def test_resident_without_society_raises_error(self, db_session):
        fake_resident = User(
            id=str(uuid.uuid4()),
            username="homeless",
            password_hash="pw",
            full_name="Homeless",
            phone="+919999999999",
            role="resident",
            society_id=None,
        )
        from app.services.camp_resident import ResidentSocietyRequiredError, list_resident_camps
        with pytest.raises(ResidentSocietyRequiredError):
            list_resident_camps(db_session, fake_resident)


class TestSocietyIsolation:
    """Verifies that residents can ONLY access camps for their own society."""

    def test_camps_filtered_by_resident_society(self, client, db_session):
        soc_a = _create_society(db_session, "Sunrise Heights")
        soc_b = _create_society(db_session, "Sunset View")
        service = _create_service(db_session, "cleaning", "Deep Cleaning")

        camp_a = _create_camp(db_session, soc_a.id, service.id)
        camp_b = _create_camp(db_session, soc_b.id, service.id)

        resident_a = _create_user(db_session, username="res_a", role="resident", society_id=soc_a.id)

        res = client.get("/api/v1/resident/camps", headers=_auth_headers(resident_a))
        assert res.status_code == 200
        camp_ids = [c["id"] for c in res.json()]

        assert camp_a.id in camp_ids
        assert camp_b.id not in camp_ids

    def test_cross_society_camp_detail_returns_404(self, client, db_session):
        soc_a = _create_society(db_session, "Sunrise Heights")
        soc_b = _create_society(db_session, "Sunset View")
        service = _create_service(db_session, "cleaning2", "Deep Cleaning 2")

        camp_b = _create_camp(db_session, soc_b.id, service.id)
        resident_a = _create_user(db_session, username="res_a2", role="resident", society_id=soc_a.id)

        res = client.get(f"/api/v1/resident/camps/{camp_b.id}", headers=_auth_headers(resident_a))
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()


class TestProvisionalPricingAndNextTier:
    """Verifies provisional pricing and next-tier calculations matching demo numbers."""

    def test_pricing_ladder_with_zero_participants(self, client, db_session):
        soc = _create_society(db_session, "Green Valley")
        service = _create_service(db_session, "pest", "Pest Control")
        camp = _create_camp(db_session, soc.id, service.id, base_price_paise=80000)
        resident = _create_user(db_session, username="res_green", role="resident", society_id=soc.id)

        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(resident))
        assert res.status_code == 200
        data = res.json()

        assert data["participants_count"] == 0
        assert data["base_price_paise"] == 80000
        assert data["base_price_rupees"] == 800.0
        assert data["current_price_paise"] == 80000
        assert data["current_price_rupees"] == 800.0
        assert data["discount_pct"] == 0
        assert data["spots_remaining"] == camp.max_participants
        assert data["can_join"] is True

        # Next tier requires 3 homes for 10% off (Rs 720)
        assert data["next_tier"] is not None
        assert data["next_tier"]["more_needed"] == 3
        assert data["next_tier"]["target_participants"] == 3
        assert data["next_tier"]["discount_pct"] == 10
        assert data["next_tier"]["target_price_paise"] == 72000
        assert data["next_tier"]["target_price_rupees"] == 720.0

        # Tiers status in detail
        tiers = {t["min_participants"]: t for t in data["tiers"]}
        assert tiers[3]["status"] == "next"
        assert tiers[6]["status"] == "upcoming"
        assert tiers[10]["status"] == "upcoming"

    def test_pricing_updates_dynamically_with_headcount(self, client, db_session):
        soc = _create_society(db_session, "Silver Oak")
        service = _create_service(db_session, "plumbing", "Plumbing Camp")
        camp = _create_camp(db_session, soc.id, service.id, base_price_paise=80000)

        # Create 3 neighbours and bookings
        u1 = _create_user(db_session, username="n1", society_id=soc.id)
        u2 = _create_user(db_session, username="n2", society_id=soc.id)
        u3 = _create_user(db_session, username="n3", society_id=soc.id)
        _add_booking(db_session, camp.id, u1.id)
        _add_booking(db_session, camp.id, u2.id)
        _add_booking(db_session, camp.id, u3.id)

        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(u1))
        assert res.status_code == 200
        data = res.json()

        assert data["participants_count"] == 3
        # Rs 800 with 10% discount = Rs 720 (72000 paise)
        assert data["current_price_paise"] == 72000
        assert data["current_price_rupees"] == 720.0
        assert data["discount_pct"] == 10

        # Next tier is 6 participants for 15% off (Rs 680) -> 3 more needed
        assert data["next_tier"]["more_needed"] == 3
        assert data["next_tier"]["target_participants"] == 6
        assert data["next_tier"]["discount_pct"] == 15
        assert data["next_tier"]["target_price_paise"] == 68000
        assert data["next_tier"]["target_price_rupees"] == 680.0

        # User 1 is already booked -> can_join is False, user_booking is present
        assert data["can_join"] is False
        assert data["user_booking"] is not None
        assert data["user_booking"]["status"] == "joined"

    def test_highest_tier_reached_has_no_next_tier(self, client, db_session):
        soc = _create_society(db_session, "Golden Palms")
        service = _create_service(db_session, "carpentry", "Carpentry Camp")
        camp = _create_camp(db_session, soc.id, service.id, base_price_paise=80000, max_participants=15)

        users = [_create_user(db_session, username=f"gp_{i}", society_id=soc.id) for i in range(10)]
        for u in users:
            _add_booking(db_session, camp.id, u.id)

        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(users[0]))
        assert res.status_code == 200
        data = res.json()

        assert data["participants_count"] == 10
        # Rs 800 with 20% discount = Rs 640 (64000 paise)
        assert data["current_price_paise"] == 64000
        assert data["current_price_rupees"] == 640.0
        assert data["discount_pct"] == 20
        assert data["next_tier"] is None

        tiers = {t["min_participants"]: t for t in data["tiers"]}
        assert tiers[3]["status"] == "reached"
        assert tiers[6]["status"] == "reached"
        assert tiers[10]["status"] == "current"


class TestResidentPrivacyAndCapacityRules:
    """Verifies Decision P6 (privacy/counts only) and capacity/deadline edge cases."""

    def test_no_neighbor_personal_info_in_responses(self, client, db_session):
        soc = _create_society(db_session, "Palm Meadows")
        service = _create_service(db_session, "inspection", "Safety Inspection")
        camp = _create_camp(db_session, soc.id, service.id)

        u1 = _create_user(db_session, username="secret_neighbor", society_id=soc.id, unit_label="Flat 901")
        _add_booking(db_session, camp.id, u1.id)

        u2 = _create_user(db_session, username="inquiring_neighbor", society_id=soc.id, unit_label="Flat 102")

        res_list = client.get("/api/v1/resident/camps", headers=_auth_headers(u2))
        res_detail = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(u2))

        # Check neither response body contains personal neighbor data
        for response in (res_list, res_detail):
            content = response.text
            assert "secret_neighbor" not in content
            assert "Flat 901" not in content

    def test_cancelled_booking_does_not_count_and_allows_rejoining(self, client, db_session):
        soc = _create_society(db_session, "Lake View")
        service = _create_service(db_session, "filter", "RO Water Filter Service")
        camp = _create_camp(db_session, soc.id, service.id)

        u = _create_user(db_session, username="fickle_resident", society_id=soc.id)
        # Cancelled booking
        _add_booking(db_session, camp.id, u.id, status="cancelled")

        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(u))
        data = res.json()

        assert data["participants_count"] == 0
        assert data["user_booking"] is None
        assert data["can_join"] is True

    def test_full_camp_cannot_be_joined(self, client, db_session):
        soc = _create_society(db_session, "Hill View")
        service = _create_service(db_session, "gardening", "Balcony Gardening")
        camp = _create_camp(db_session, soc.id, service.id, min_participants=1, max_participants=2)

        u1 = _create_user(db_session, username="hv1", society_id=soc.id)
        u2 = _create_user(db_session, username="hv2", society_id=soc.id)
        _add_booking(db_session, camp.id, u1.id)
        _add_booking(db_session, camp.id, u2.id)

        u3 = _create_user(db_session, username="hv3", society_id=soc.id)
        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(u3))
        data = res.json()

        assert data["spots_remaining"] == 0
        assert data["can_join"] is False

    def test_past_deadline_camp_cannot_be_joined(self, client, db_session):
        soc = _create_society(db_session, "Orchid Heights")
        service = _create_service(db_session, "electrical", "Electrical Checkup")

        now = datetime.now(timezone.utc)
        camp = Camp(
            society_id=soc.id,
            service_id=service.id,
            title="Late Camp",
            starts_at=now + timedelta(hours=10),
            ends_at=now + timedelta(hours=14),
            slot_minutes=30,
            min_participants=2,
            max_participants=8,
            join_deadline=now - timedelta(minutes=5),  # Past deadline
            base_price_paise=50000,
            status="open",
        )
        db_session.add(camp)
        db_session.commit()

        resident = _create_user(db_session, username="late_resident", society_id=soc.id)
        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(resident))
        data = res.json()

        assert data["can_join"] is False

    def test_price_disclaimer_present_in_detail(self, client, db_session):
        soc = _create_society(db_session, "Disclaimers Society")
        service = _create_service(db_session, "ac_clean", "AC Cleaning")
        camp = _create_camp(db_session, soc.id, service.id)
        resident = _create_user(db_session, username="disclaim_res", society_id=soc.id)

        res = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(resident))
        data = res.json()

        assert "provisional" in data["price_disclaimer"].lower()
        assert "locks" in data["price_disclaimer"].lower()
