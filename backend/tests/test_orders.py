from __future__ import annotations

from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session

from app.core.csrf import create_csrf_token
from app.core.security import create_access_token
from app.models.camp import Camp, CampPriceTier
from app.models.order import Order
from app.models.service import Service
from app.models.society import Society
from app.models.user import User
from app.repositories.order_repo import OrderRepository
from app.services.order_service import (
    AlreadyBookedError,
    CampCapacityExceededError,
    CampNotOpenError,
    cancel_order,
    create_order,
    list_resident_orders,
)


def _setup_open_camp(db: Session) -> tuple[Society, Service, Camp, User]:
    society = Society(name="Beta", address="Lane", city="Bengaluru", invite_code="BETA-1")
    service = Service(code="ac_service_order_test", name="AC Test Service")
    db.add_all([society, service])
    db.flush()

    resident = User(
        username="order_resident",
        password_hash="fakehash",
        full_name="Order Resident",
        phone="+919876543111",
        role="resident",
        society_id=society.id,
        unit_label="Flat 301",
    )
    db.add(resident)
    db.flush()

    now = datetime.now(timezone.utc)
    camp = Camp(
        society_id=society.id,
        service_id=service.id,
        title="Group AC Order Camp",
        starts_at=now + timedelta(days=5),
        ends_at=now + timedelta(days=5, hours=8),
        slot_minutes=60,
        min_participants=2,
        max_participants=2,  # capped at 2 for testing capacity ceiling
        join_deadline=now + timedelta(days=3),
        base_price_paise=99900,
        status="open",
    )
    db.add(camp)
    db.flush()

    tier = CampPriceTier(camp_id=camp.id, min_participants=1, discount_pct=0)
    db.add(tier)
    db.commit()
    return society, service, camp, resident


def test_order_service_lifecycle(db_session: Session) -> None:
    society, service, camp, resident = _setup_open_camp(db_session)

    # 1. Create order
    booking = create_order(db_session, camp_id=camp.id, resident=resident)
    assert booking.id is not None
    assert booking.status == "joined"
    assert booking.quoted_price_paise == 99900

    # 2. Cannot book twice in same camp
    with pytest.raises(AlreadyBookedError):
        create_order(db_session, camp_id=camp.id, resident=resident)

    # 3. Add second resident to reach capacity
    resident2 = User(
        username="order_resident_2",
        password_hash="fakehash",
        full_name="Second Resident",
        phone="+919876543112",
        role="resident",
        society_id=society.id,
        unit_label="Flat 302",
    )
    db_session.add(resident2)
    db_session.flush()

    create_order(db_session, camp_id=camp.id, resident=resident2)

    # 4. Third resident exceeds capacity
    resident3 = User(
        username="order_resident_3",
        password_hash="fakehash",
        full_name="Third Resident",
        phone="+919876543113",
        role="resident",
        society_id=society.id,
        unit_label="Flat 303",
    )
    db_session.add(resident3)
    db_session.flush()

    with pytest.raises(CampCapacityExceededError):
        create_order(db_session, camp_id=camp.id, resident=resident3)

    # 5. List resident orders
    orders = list_resident_orders(db_session, resident.id)
    assert len(orders) == 1

    # 6. Cancel order
    cancelled = cancel_order(db_session, booking.id, resident.id)
    assert cancelled.status == "cancelled"
    assert cancelled.cancelled_at is not None

    # 7. OrderRepository lookup
    repo = OrderRepository(db_session)
    order_from_repo = repo.get_by_id(booking.id)
    assert order_from_repo is not None
    assert isinstance(order_from_repo, Order)


def test_order_api_endpoints(client, db_session: Session) -> None:
    _, _, camp, resident = _setup_open_camp(db_session)

    token = create_access_token(resident.id)
    client.cookies.set("domora_access", token)
    csrf_token, _ = create_csrf_token()
    client.cookies.set("domora_csrf", csrf_token)
    headers = {"Origin": "http://localhost:5173", "X-CSRF-Token": csrf_token}

    # 1. Place order via POST /api/orders
    resp = client.post(
        "/api/orders",
        json={"camp_id": camp.id},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["camp_id"] == camp.id
    assert data["status"] == "joined"
    order_id = data["id"]

    # 2. Get my orders via GET /api/orders
    list_resp = client.get("/api/orders")
    assert list_resp.status_code == 200
    my_orders = list_resp.json()
    assert len(my_orders) == 1
    assert my_orders[0]["id"] == order_id

    # 3. Get single order via GET /api/orders/{id}
    detail_resp = client.get(f"/api/orders/{order_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == order_id

    # 4. Cancel order via POST /api/orders/{id}/cancel
    cancel_resp = client.post(
        f"/api/orders/{order_id}/cancel",
        headers=headers,
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"
