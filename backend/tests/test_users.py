from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.society import Society
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.services.user_service import (
    DuplicateAccountError,
    InvalidCredentialsError,
    InvalidInviteCodeError,
    authenticate_user,
    create_resident,
    list_vendors,
)


def test_user_repository_and_service(db_session: Session) -> None:
    # 1. Setup Society
    society = Society(
        name="Test Society",
        address="123 Road",
        city="Bengaluru",
        invite_code="TEST-INVITE",
    )
    db_session.add(society)
    db_session.commit()

    # 2. Create Resident via Service
    user = create_resident(
        db_session,
        username="john_doe",
        password="ValidPassword123!",
        full_name="John Doe",
        phone="+919876543000",
        unit_label="Flat 101",
        invite_code="TEST-INVITE",
    )
    db_session.commit()
    assert user.id is not None
    assert user.role == "resident"

    # 3. Test Invalid Invite Code
    with pytest.raises(InvalidInviteCodeError):
        create_resident(
            db_session,
            username="another_user",
            password="ValidPassword123!",
            full_name="Another User",
            phone="+919876543001",
            unit_label="Flat 102",
            invite_code="INVALID-CODE",
        )

    # 4. Test Duplicate Account
    with pytest.raises(DuplicateAccountError):
        create_resident(
            db_session,
            username="john_doe",
            password="ValidPassword123!",
            full_name="Duplicate User",
            phone="+919876543002",
            unit_label="Flat 103",
            invite_code="TEST-INVITE",
        )

    # 5. Test Authentication
    auth_user = authenticate_user(db_session, username="john_doe", password="ValidPassword123!")
    assert auth_user.id == user.id

    with pytest.raises(InvalidCredentialsError):
        authenticate_user(db_session, username="john_doe", password="WrongPassword!")

    # 6. Test Repository lookups
    repo = UserRepository(db_session)
    assert repo.get_by_username("john_doe") is not None
    assert repo.get_by_phone("+919876543000") is not None
    assert repo.get_by_username("nonexistent") is None


def test_user_api_endpoints(client, db_session: Session) -> None:
    # 1. Create a society and an ops user
    society = Society(name="Alpha", address="Road", city="Bengaluru", invite_code="ALPHA-1")
    db_session.add(society)
    db_session.flush()

    ops_user = User(
        username="ops_tester",
        password_hash="fakehash",
        full_name="Ops Tester",
        phone="+919876543099",
        role="ops",
    )
    vendor_user = User(
        username="vendor_tester",
        password_hash="fakehash",
        full_name="Vendor Tester",
        phone="+919876543098",
        role="vendor",
    )
    db_session.add_all([ops_user, vendor_user])
    db_session.commit()

    token = create_access_token(ops_user.id)
    client.cookies.set("domora_access", token)

    # Test GET /api/users/me
    resp = client.get("/api/users/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "ops_tester"
    assert data["role"] == "ops"

    # Test GET /api/v1/users/me
    v1_resp = client.get("/api/v1/users/me")
    assert v1_resp.status_code == 200
    assert v1_resp.json()["username"] == "ops_tester"

    # Test GET /api/users/vendors
    vendors_resp = client.get("/api/users/vendors")
    assert vendors_resp.status_code == 200
    vendors = vendors_resp.json()
    assert len(vendors) >= 1
    assert vendors[0]["full_name"] == "Vendor Tester"
