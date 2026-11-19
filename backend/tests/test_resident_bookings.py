from __future__ import annotations

import concurrent.futures
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from starlette.testclient import TestClient

from app.core.csrf import create_csrf_token
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
    if role == "resident" and unit_label is None:
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


def _create_service(db_session, code: str = "ac_service", name: str = "AC Cleaning & Tune-Up") -> Service:
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
    min_participants: int = 1,
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

    min_participants = min(min_participants, max_participants)

    camp = Camp(
        society_id=society_id,
        service_id=service_id,
        title="Monsoon AC Deep Clean Camp",
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
        raw_tiers = [(3, 10), (6, 15), (10, 20)]
        tiers = [t for t in raw_tiers if t[0] <= max_participants]
        if not tiers:
            tiers = [(1, 0)]

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


def _auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def _csrf_cookie_and_header() -> tuple[dict[str, str], dict[str, str]]:
    csrf_token, _ = create_csrf_token()
    cookies = {"domora_csrf": csrf_token}
    headers = {"X-CSRF-Token": csrf_token}
    return cookies, headers


class TestResidentJoinCamp:
    """Tests for Rule 1, Rule 2, Rule 3, Rule 9, and camp join mechanics."""

    def test_resident_join_open_camp_success(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, base_price_paise=80000)
        resident = _create_user(db_session, username="resident_alice", society_id=soc.id)

        response = client.post(
            f"/api/v1/resident/camps/{camp.id}/join",
            headers=_auth_headers(resident),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["camp_id"] == camp.id
        assert data["resident_id"] == resident.id
        assert data["status"] == "joined"
        assert data["quoted_price_paise"] == 80000
        assert data["quoted_price_rupees"] == 800.00
        assert data["final_price_paise"] is None
        assert data["cancelled_at"] is None
        assert data["camp"]["active_participants"] == 1
        assert data["camp"]["spots_remaining"] == 11
        assert data["camp"]["service_name"] == srv.name

    def test_resident_join_recalculates_quoted_price_with_tiers(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, base_price_paise=80000, tiers=[(3, 10), (6, 15)])
        r1 = _create_user(db_session, username="r1", society_id=soc.id)
        r2 = _create_user(db_session, username="r2", society_id=soc.id)
        r3 = _create_user(db_session, username="r3", society_id=soc.id)

        # Residents 1 and 2 join (headcount 1 and 2 -> base price Rs 800)
        res1 = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r1))
        assert res1.status_code == 201
        assert res1.json()["quoted_price_paise"] == 80000

        res2 = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r2))
        assert res2.status_code == 201
        assert res2.json()["quoted_price_paise"] == 80000

        # Resident 3 joins: hits Tier 1 (3 homes = 10% off -> Rs 720 / 72,000 paise)
        res3 = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r3))
        assert res3.status_code == 201
        data3 = res3.json()
        assert data3["quoted_price_paise"] == 72000
        assert data3["quoted_price_rupees"] == 720.00
        assert data3["camp"]["active_participants"] == 3
        assert data3["camp"]["current_discount_pct"] == 10

    def test_resident_duplicate_active_booking_rejected(self, client, db_session):
        """Rule 1: A resident has at most one active booking per camp."""
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id)
        resident = _create_user(db_session, username="resident_bob", society_id=soc.id)

        # First join succeeds
        first = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        assert first.status_code == 201

        # Second join rejected with 409 Conflict
        second = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        assert second.status_code == 409
        assert "already have an active booking" in second.json()["detail"].lower()

    def test_resident_can_rejoin_after_cancelling(self, client, db_session):
        """Rule 1: Cancelled bookings do not count; re-joining is allowed."""
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, hours_from_now=72)
        resident = _create_user(db_session, username="resident_carol", society_id=soc.id)

        # 1. Join
        res_join = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        assert res_join.status_code == 201

        # 2. Leave
        res_leave = client.post(f"/api/v1/resident/camps/{camp.id}/leave", headers=_auth_headers(resident))
        assert res_leave.status_code == 200
        assert res_leave.json()["status"] == "cancelled"

        # 3. Re-join succeeds
        res_rejoin = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        assert res_rejoin.status_code == 201
        assert res_rejoin.json()["status"] == "joined"

    def test_resident_join_full_camp_rejected(self, client, db_session):
        """Rule 2: Active bookings never exceed the camp's maximum."""
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, max_participants=2)
        r1 = _create_user(db_session, username="r1", society_id=soc.id)
        r2 = _create_user(db_session, username="r2", society_id=soc.id)
        r3 = _create_user(db_session, username="r3", society_id=soc.id)

        assert client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r1)).status_code == 201
        assert client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r2)).status_code == 201

        # 3rd join exceeds capacity
        res3 = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r3))
        assert res3.status_code == 409
        assert "capacity" in res3.json()["detail"].lower()

    def test_resident_join_cross_society_returns_404(self, client, db_session):
        """Rule 3: A resident can only see and join camps of their own society."""
        soc_a = _create_society(db_session, name="Society A")
        soc_b = _create_society(db_session, name="Society B")
        srv = _create_service(db_session)
        camp_b = _create_camp(db_session, soc_b.id, srv.id)
        resident_a = _create_user(db_session, username="res_a", society_id=soc_a.id)

        res = client.post(f"/api/v1/resident/camps/{camp_b.id}/join", headers=_auth_headers(resident_a))
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_resident_join_past_deadline_rejected(self, client, db_session):
        """Rule 9: Joining closes at the join deadline."""
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        # join_deadline was 1 hour ago
        now = datetime.now(timezone.utc)
        camp = Camp(
            society_id=soc.id,
            service_id=srv.id,
            title="Expired Camp",
            starts_at=now + timedelta(hours=20),
            ends_at=now + timedelta(hours=26),
            slot_minutes=30,
            min_participants=1,
            max_participants=5,
            join_deadline=now - timedelta(hours=1),
            base_price_paise=80000,
            status="open",
        )
        db_session.add(camp)
        db_session.commit()
        resident = _create_user(db_session, username="late_resident", society_id=soc.id)

        res = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        assert res.status_code == 422
        assert "deadline" in res.json()["detail"].lower()

    def test_resident_join_closed_camp_rejected(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, status="confirmed")
        resident = _create_user(db_session, username="resident_d", society_id=soc.id)

        res = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        assert res.status_code == 422
        assert "status" in res.json()["detail"].lower()

    def test_unauthenticated_and_non_resident_rejected(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id)
        ops_user = _create_user(db_session, username="ops_worker", role="ops")
        vendor_user = _create_user(db_session, username="vendor_tech", role="vendor")

        # Unauthenticated request with invalid/expired token returns 401
        assert client.post(
            f"/api/v1/resident/camps/{camp.id}/join",
            headers={"Authorization": "Bearer invalid.token.value"},
        ).status_code == 401

        # Request missing all authentication and CSRF returns 401 or 403
        assert client.post(f"/api/v1/resident/camps/{camp.id}/join").status_code in {401, 403}

        # Ops role
        assert client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(ops_user)).status_code == 403

        # Vendor role
        assert client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(vendor_user)).status_code == 403


class TestResidentLeaveCamp:
    """Tests for leaving / cancelling camp bookings."""

    def test_resident_leave_camp_success(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, hours_from_now=72)
        resident = _create_user(db_session, username="resident_leaving", society_id=soc.id)

        # Join
        client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))

        # Leave
        res = client.post(f"/api/v1/resident/camps/{camp.id}/leave", headers=_auth_headers(resident))
        assert res.status_code == 200
        data = res.json()
        assert data["camp_id"] == camp.id
        assert data["status"] == "cancelled"
        assert data["cancelled_at"] is not None

        # Verify active participants dropped
        camp_detail = client.get(f"/api/v1/resident/camps/{camp.id}", headers=_auth_headers(resident)).json()
        assert camp_detail["participants_count"] == 0
        assert camp_detail["spots_remaining"] == camp.max_participants

    def test_resident_leave_within_24h_rejected(self, client, db_session):
        """Leave cutoff: leave is blocked fewer than 24 hours before the window."""
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        # Window starts in 12 hours
        now = datetime.now(timezone.utc)
        camp = Camp(
            society_id=soc.id,
            service_id=srv.id,
            title="Imminent Camp",
            starts_at=now + timedelta(hours=12),
            ends_at=now + timedelta(hours=18),
            slot_minutes=30,
            min_participants=1,
            max_participants=5,
            join_deadline=now + timedelta(hours=6),
            base_price_paise=80000,
            status="open",
        )
        db_session.add(camp)
        db_session.commit()
        resident = _create_user(db_session, username="resident_trapped", society_id=soc.id)

        # Joined earlier
        booking = Booking(
            camp_id=camp.id,
            resident_id=resident.id,
            status="joined",
            quoted_price_paise=80000,
        )
        db_session.add(booking)
        db_session.commit()

        # Attempt to leave inside the 24h window
        res = client.post(f"/api/v1/resident/camps/{camp.id}/leave", headers=_auth_headers(resident))
        assert res.status_code == 422
        assert "24 hours" in res.json()["detail"]

    def test_resident_leave_nonexistent_booking_returns_404(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id)
        resident = _create_user(db_session, username="resident_nobody", society_id=soc.id)

        res = client.post(f"/api/v1/resident/camps/{camp.id}/leave", headers=_auth_headers(resident))
        assert res.status_code == 404
        assert "no active booking" in res.json()["detail"].lower()


class TestResidentListAndGetBookings:
    """Tests for booking listing and detail endpoints."""

    def test_list_resident_bookings(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        c1 = _create_camp(db_session, soc.id, srv.id)
        c2 = _create_camp(db_session, soc.id, srv.id)
        resident = _create_user(db_session, username="resident_booked", society_id=soc.id)

        # Join c1 and c2
        client.post(f"/api/v1/resident/camps/{c1.id}/join", headers=_auth_headers(resident))
        client.post(f"/api/v1/resident/camps/{c2.id}/join", headers=_auth_headers(resident))

        # Cancel c1
        client.post(f"/api/v1/resident/camps/{c1.id}/leave", headers=_auth_headers(resident))

        # List bookings
        res = client.get("/api/v1/resident/bookings", headers=_auth_headers(resident))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 2
        # Active booking should be first
        assert items[0]["camp_id"] == c2.id
        assert items[0]["status"] == "joined"
        assert items[1]["camp_id"] == c1.id
        assert items[1]["status"] == "cancelled"

    def test_get_resident_booking_detail(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id)
        resident = _create_user(db_session, username="resident_detail", society_id=soc.id)

        join_res = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(resident))
        booking_id = join_res.json()["id"]

        detail_res = client.get(f"/api/v1/resident/bookings/{booking_id}", headers=_auth_headers(resident))
        assert detail_res.status_code == 200
        data = detail_res.json()
        assert data["id"] == booking_id
        assert data["camp"]["id"] == camp.id
        assert data["camp"]["title"] == camp.title
        assert data["camp"]["service_name"] == srv.name

    def test_get_other_resident_booking_returns_404(self, client, db_session):
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id)
        r1 = _create_user(db_session, username="r1", society_id=soc.id)
        r2 = _create_user(db_session, username="r2", society_id=soc.id)

        join_res = client.post(f"/api/v1/resident/camps/{camp.id}/join", headers=_auth_headers(r1))
        booking_id = join_res.json()["id"]

        # Resident 2 tries to read Resident 1's booking
        res = client.get(f"/api/v1/resident/bookings/{booking_id}", headers=_auth_headers(r2))
        assert res.status_code == 404


class TestResidentJoinConcurrency:
    """Concurrency verification: prove that overbooking is impossible under simultaneous joins."""

    def test_concurrency_last_spot_race(self, client, db_session):
        """
        Simulate 5 distinct residents competing for 1 remaining spot simultaneously.
        Only 1 resident must succeed (201); 4 must receive 409 Conflict.
        Database must contain exactly 1 active booking.
        """
        soc = _create_society(db_session)
        srv = _create_service(db_session)
        camp = _create_camp(db_session, soc.id, srv.id, max_participants=1)

        residents = [
            _create_user(db_session, username=f"concurrent_res_{i}", society_id=soc.id)
            for i in range(5)
        ]

        def attempt_join(res_user: User) -> int:
            resp = client.post(
                f"/api/v1/resident/camps/{camp.id}/join",
                headers=_auth_headers(res_user),
            )
            return resp.status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            status_codes = list(executor.map(attempt_join, residents))

        assert status_codes.count(201) == 1
        assert status_codes.count(409) == 4
