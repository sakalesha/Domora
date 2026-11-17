from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.domain import Booking, Camp, CampPriceTier, Service, Society, User
from app.services.auth import hash_password


def _create_user(
    db_session,
    *,
    username: str,
    role: str = "ops",
    is_active: bool = True,
    society_id: str | None = None,
    unit_label: str | None = None,
) -> User:
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


def _create_society(db_session, name: str = "Emerald Heights") -> Society:
    soc = Society(
        name=name,
        address="100 Residency Road",
        city="Bengaluru",
        invite_code=f"SOC-{uuid.uuid4().hex[:6].upper()}",
    )
    db_session.add(soc)
    db_session.commit()
    db_session.refresh(soc)
    return soc


def _create_service(db_session, code: str = "ac_service", name: str = "AC Deep Cleaning") -> Service:
    srv = Service(code=code, name=name)
    db_session.add(srv)
    db_session.commit()
    db_session.refresh(srv)
    return srv


def _auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def _valid_camp_payload(society_id: str, service_id: str, vendor_id: str | None = None) -> dict:
    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(days=5)
    ends_at = starts_at + timedelta(hours=6)  # 6h = 360 min -> 12 slots of 30 min
    join_deadline = starts_at - timedelta(hours=25)  # > 24h prior

    return {
        "society_id": society_id,
        "service_id": service_id,
        "title": "Summer AC Overhaul Camp",
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
        "slot_minutes": 30,
        "min_participants": 3,
        "max_participants": 12,
        "join_deadline": join_deadline.isoformat(),
        "base_price_paise": 80000,
        "vendor_id": vendor_id,
        "price_tiers": [
            {"min_participants": 3, "discount_pct": 10},
            {"min_participants": 6, "discount_pct": 15},
            {"min_participants": 10, "discount_pct": 20},
        ],
    }


# ============================================================================
# 1. Role Authorization & Authentication Tests
# ============================================================================


def test_unauthenticated_request_rejected(client):
    response = client.get("/api/ops/camps")
    assert response.status_code == 401


def test_resident_role_forbidden(client, db_session):
    society = _create_society(db_session)
    resident = _create_user(db_session, username="resident_user", role="resident", society_id=society.id, unit_label="A-101")
    response = client.get("/api/ops/camps", headers=_auth_headers(resident))
    assert response.status_code == 403


def test_vendor_role_forbidden(client, db_session):
    vendor = _create_user(db_session, username="vendor_user", role="vendor")
    response = client.get("/api/ops/camps", headers=_auth_headers(vendor))
    assert response.status_code == 403


def test_inactive_ops_rejected(client, db_session):
    ops_user = _create_user(db_session, username="inactive_ops", role="ops", is_active=False)
    response = client.get("/api/ops/camps", headers=_auth_headers(ops_user))
    assert response.status_code == 401


def test_ops_role_authorized(client, db_session):
    ops_user = _create_user(db_session, username="active_ops", role="ops")
    response = client.get("/api/ops/camps", headers=_auth_headers(ops_user))
    assert response.status_code == 200
    assert response.json() == []


# ============================================================================
# 2. Reference Data Endpoints
# ============================================================================


def test_reference_endpoints(client, db_session):
    ops_user = _create_user(db_session, username="ops_ref", role="ops")
    society = _create_society(db_session, name="Palm Grove")
    service = _create_service(db_session, code="pest_control", name="Pest Eradication")
    vendor = _create_user(db_session, username="active_vendor", role="vendor")
    _create_user(db_session, username="inactive_vendor", role="vendor", is_active=False)

    headers = _auth_headers(ops_user)

    # Societies
    soc_resp = client.get("/api/ops/societies", headers=headers)
    assert soc_resp.status_code == 200
    assert any(s["id"] == society.id for s in soc_resp.json())

    # Services
    srv_resp = client.get("/api/ops/services", headers=headers)
    assert srv_resp.status_code == 200
    assert any(s["id"] == service.id for s in srv_resp.json())

    # Vendors (only active)
    ven_resp = client.get("/api/ops/vendors", headers=headers)
    assert ven_resp.status_code == 200
    vendors = ven_resp.json()
    assert any(v["id"] == vendor.id for v in vendors)
    assert not any(v["full_name"] == "User inactive_vendor" for v in vendors)


# ============================================================================
# 3. Camp Creation (POST /ops/camps)
# ============================================================================


def test_create_camp_happy_path(client, db_session):
    ops_user = _create_user(db_session, username="ops_creator", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)
    vendor = _create_user(db_session, username="assigned_vendor", role="vendor")

    payload = _valid_camp_payload(society.id, service.id, vendor.id)
    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))

    assert response.status_code == 201
    data = response.json()

    assert data["title"] == payload["title"]
    assert data["status"] == "open"
    assert data["capacity_slots"] == 12
    assert data["base_price_paise"] == 80000
    assert data["society"]["id"] == society.id
    assert data["service"]["id"] == service.id
    assert data["vendor"]["id"] == vendor.id
    assert len(data["price_tiers"]) == 3
    assert data["price_tiers"][0] == {"min_participants": 3, "discount_pct": 10}
    assert data["price_tiers"][1] == {"min_participants": 6, "discount_pct": 15}
    assert data["price_tiers"][2] == {"min_participants": 10, "discount_pct": 20}
    assert data["pricing_quote"]["headcount"] == 0
    assert data["pricing_quote"]["discounted_price_paise"] == 80000
    assert data["pricing_quote"]["next_tier"]["min_participants"] == 3
    assert data["pricing_quote"]["next_tier"]["participants_needed"] == 3
    assert data["participants"] == []


def test_create_camp_without_vendor(client, db_session):
    ops_user = _create_user(db_session, username="ops_novendor", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id, None)
    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))

    assert response.status_code == 201
    assert response.json()["vendor"] is None


def test_create_camp_invalid_window_ends_before_starts(client, db_session):
    ops_user = _create_user(db_session, username="ops_inv_win", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id)
    # Swap starts_at and ends_at
    payload["starts_at"], payload["ends_at"] = payload["ends_at"], payload["starts_at"]

    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))
    assert response.status_code == 400
    assert "starts_at must be strictly before ends_at" in response.json()["detail"]


def test_create_camp_deadline_less_than_24h_before_start(client, db_session):
    ops_user = _create_user(db_session, username="ops_inv_dl", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id)
    # Set deadline 10 hours before start instead of >= 24h
    starts_dt = datetime.fromisoformat(payload["starts_at"])
    payload["join_deadline"] = (starts_dt - timedelta(hours=10)).isoformat()

    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))
    assert response.status_code == 400
    assert "at least 24 hours before starts_at" in response.json()["detail"]


def test_create_camp_max_participants_exceeds_capacity(client, db_session):
    ops_user = _create_user(db_session, username="ops_cap_exc", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id)
    # Capacity is 12 slots; set max to 15
    payload["max_participants"] = 15

    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))
    assert response.status_code == 400
    assert "cannot exceed capacity" in response.json()["detail"]


def test_create_camp_invalid_tiers_duplicate_or_decreasing(client, db_session):
    ops_user = _create_user(db_session, username="ops_tier_inv", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id)
    # Decreasing discount
    payload["price_tiers"] = [
        {"min_participants": 3, "discount_pct": 20},
        {"min_participants": 6, "discount_pct": 10},
    ]

    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))
    assert response.status_code == 400
    assert "strictly increase" in response.json()["detail"]


def test_create_camp_tier_exceeds_max_participants(client, db_session):
    ops_user = _create_user(db_session, username="ops_tier_max", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id)
    payload["max_participants"] = 8
    payload["price_tiers"] = [
        {"min_participants": 3, "discount_pct": 10},
        {"min_participants": 10, "discount_pct": 20},  # 10 > 8
    ]

    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))
    assert response.status_code == 400
    assert "cannot exceed max_participants" in response.json()["detail"]


def test_create_camp_nonexistent_foreign_keys(client, db_session):
    ops_user = _create_user(db_session, username="ops_fk_test", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)
    fake_id = str(uuid.uuid4())

    # Invalid society
    payload1 = _valid_camp_payload(fake_id, service.id)
    r1 = client.post("/api/ops/camps", json=payload1, headers=_auth_headers(ops_user))
    assert r1.status_code == 404

    # Invalid service
    payload2 = _valid_camp_payload(society.id, fake_id)
    r2 = client.post("/api/ops/camps", json=payload2, headers=_auth_headers(ops_user))
    assert r2.status_code == 404

    # Invalid vendor
    payload3 = _valid_camp_payload(society.id, service.id, fake_id)
    r3 = client.post("/api/ops/camps", json=payload3, headers=_auth_headers(ops_user))
    assert r3.status_code == 404


def test_create_camp_with_resident_as_vendor_rejected(client, db_session):
    ops_user = _create_user(db_session, username="ops_res_ven", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)
    resident = _create_user(db_session, username="resident_wrong", role="resident", society_id=society.id, unit_label="B-202")

    payload = _valid_camp_payload(society.id, service.id, resident.id)
    response = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user))
    assert response.status_code == 404
    assert "Vendor" in response.json()["detail"]


# ============================================================================
# 4. Camp Listing and Filtering (GET /ops/camps)
# ============================================================================


def test_list_camps_filtering(client, db_session):
    ops_user = _create_user(db_session, username="ops_lister", role="ops")
    soc1 = _create_society(db_session, "Society One")
    soc2 = _create_society(db_session, "Society Two")
    srv = _create_service(db_session)

    # Create camp in soc1
    p1 = _valid_camp_payload(soc1.id, srv.id)
    c1 = client.post("/api/ops/camps", json=p1, headers=_auth_headers(ops_user)).json()

    # Create camp in soc2
    p2 = _valid_camp_payload(soc2.id, srv.id)
    c2 = client.post("/api/ops/camps", json=p2, headers=_auth_headers(ops_user)).json()

    # Unfiltered
    all_resp = client.get("/api/ops/camps", headers=_auth_headers(ops_user))
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 2

    # Filter by society
    soc1_resp = client.get(f"/api/ops/camps?society_id={soc1.id}", headers=_auth_headers(ops_user))
    assert soc1_resp.status_code == 200
    assert len(soc1_resp.json()) == 1
    assert soc1_resp.json()[0]["id"] == c1["id"]

    # Filter by status
    open_resp = client.get("/api/ops/camps?status=open", headers=_auth_headers(ops_user))
    assert open_resp.status_code == 200
    assert len(open_resp.json()) == 2

    confirmed_resp = client.get("/api/ops/camps?status=confirmed", headers=_auth_headers(ops_user))
    assert confirmed_resp.status_code == 200
    assert len(confirmed_resp.json()) == 0


# ============================================================================
# 5. Camp Detail with Bookings and Pricing (GET /ops/camps/{camp_id})
# ============================================================================


def test_get_camp_detail_with_participants(client, db_session):
    ops_user = _create_user(db_session, username="ops_detailer", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)

    payload = _valid_camp_payload(society.id, service.id)
    created_camp = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user)).json()
    camp_id = created_camp["id"]

    # Add 3 active bookings and 1 cancelled booking
    now = datetime.now(timezone.utc)
    for i in range(1, 4):
        resident = _create_user(db_session, username=f"res_{i}", role="resident", society_id=society.id, unit_label=f"A-{i}01")
        booking = Booking(
            camp_id=camp_id,
            resident_id=resident.id,
            status="joined",
            quoted_price_paise=72000,
            created_at=now + timedelta(minutes=i),
        )
        db_session.add(booking)

    # Cancelled booking
    cancelled_res = _create_user(db_session, username="res_cancelled", role="resident", society_id=society.id, unit_label="C-99")
    cancelled_booking = Booking(
        camp_id=camp_id,
        resident_id=cancelled_res.id,
        status="cancelled",
        quoted_price_paise=80000,
        cancelled_at=now + timedelta(minutes=10),
    )
    db_session.add(cancelled_booking)
    db_session.commit()

    # Fetch camp detail
    detail_resp = client.get(f"/api/ops/camps/{camp_id}", headers=_auth_headers(ops_user))
    assert detail_resp.status_code == 200
    detail = detail_resp.json()

    # Active headcount should be 3 (cancelled ignored)
    assert detail["pricing_quote"]["headcount"] == 3
    # 3 homes unlocks Tier 1: 10% discount -> 72,000 paise
    assert detail["pricing_quote"]["discount_pct"] == 10
    assert detail["pricing_quote"]["discounted_price_paise"] == 72000
    # Next tier is 6 homes (15% discount), needs 3 more
    assert detail["pricing_quote"]["next_tier"]["min_participants"] == 6
    assert detail["pricing_quote"]["next_tier"]["participants_needed"] == 3
    assert detail["pricing_quote"]["next_tier"]["potential_price_paise"] == 68000

    # Participants list must only contain the 3 active bookings
    assert len(detail["participants"]) == 3
    assert [p["unit_label"] for p in detail["participants"]] == ["A-101", "A-201", "A-301"]

    # Also check list_camps reflects active count
    list_resp = client.get("/api/ops/camps", headers=_auth_headers(ops_user))
    camp_item = list_resp.json()[0]
    assert camp_item["active_participants_count"] == 3
    assert camp_item["spots_remaining"] == 9  # 12 - 3
    assert camp_item["current_price_paise"] == 72000


# ============================================================================
# 6. Vendor Assignment (PATCH /ops/camps/{camp_id}/vendor)
# ============================================================================


def test_assign_and_unassign_vendor(client, db_session):
    ops_user = _create_user(db_session, username="ops_assigner", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)
    vendor1 = _create_user(db_session, username="vendor_one", role="vendor")
    vendor2 = _create_user(db_session, username="vendor_two", role="vendor")

    # Create camp with no vendor
    payload = _valid_camp_payload(society.id, service.id, None)
    camp = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user)).json()
    camp_id = camp["id"]
    assert camp["vendor"] is None

    # Assign vendor 1
    r1 = client.patch(
        f"/api/ops/camps/{camp_id}/vendor",
        json={"vendor_id": vendor1.id},
        headers=_auth_headers(ops_user),
    )
    assert r1.status_code == 200
    assert r1.json()["vendor"]["id"] == vendor1.id

    # Switch to vendor 2
    r2 = client.patch(
        f"/api/ops/camps/{camp_id}/vendor",
        json={"vendor_id": vendor2.id},
        headers=_auth_headers(ops_user),
    )
    assert r2.status_code == 200
    assert r2.json()["vendor"]["id"] == vendor2.id

    # Unassign (set to None)
    r3 = client.patch(
        f"/api/ops/camps/{camp_id}/vendor",
        json={"vendor_id": None},
        headers=_auth_headers(ops_user),
    )
    assert r3.status_code == 200
    assert r3.json()["vendor"] is None


def test_assign_invalid_vendor_rejected(client, db_session):
    ops_user = _create_user(db_session, username="ops_assign_fail", role="ops")
    society = _create_society(db_session)
    service = _create_service(db_session)
    resident = _create_user(db_session, username="resident_not_vendor", role="resident", society_id=society.id, unit_label="D-404")

    payload = _valid_camp_payload(society.id, service.id, None)
    camp = client.post("/api/ops/camps", json=payload, headers=_auth_headers(ops_user)).json()

    # Assign non-vendor user
    r = client.patch(
        f"/api/ops/camps/{camp['id']}/vendor",
        json={"vendor_id": resident.id},
        headers=_auth_headers(ops_user),
    )
    assert r.status_code == 404
