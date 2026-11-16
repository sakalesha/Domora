import pytest
from sqlalchemy import select

from app.models.domain import User
from scripts.seed import _read_privileged_account, _seed_privileged_user


def test_privileged_seed_configuration_is_optional(monkeypatch):
    for key in ("SEED_OPS_USERNAME", "SEED_OPS_PASSWORD", "SEED_OPS_FULL_NAME", "SEED_OPS_PHONE"):
        monkeypatch.delenv(key, raising=False)

    assert _read_privileged_account("ops") is None


def test_privileged_seed_rejects_partial_configuration(monkeypatch):
    monkeypatch.setenv("SEED_OPS_USERNAME", "operator")
    monkeypatch.delenv("SEED_OPS_PASSWORD", raising=False)
    monkeypatch.delenv("SEED_OPS_FULL_NAME", raising=False)
    monkeypatch.delenv("SEED_OPS_PHONE", raising=False)

    with pytest.raises(RuntimeError, match="SEED_OPS_"):
        _read_privileged_account("ops")


def test_privileged_seed_rejects_default_password(monkeypatch):
    monkeypatch.setenv("SEED_OPS_USERNAME", "operator")
    monkeypatch.setenv("SEED_OPS_PASSWORD", "password1234")
    monkeypatch.setenv("SEED_OPS_FULL_NAME", "Operator")
    monkeypatch.setenv("SEED_OPS_PHONE", "+919900000009")

    with pytest.raises(RuntimeError, match="password"):
        _read_privileged_account("ops")


@pytest.mark.parametrize("role", ["ops", "vendor"])
def test_privileged_seed_creates_only_configured_role(db_session, role):
    account = {
        "username": f"seeded-{role}",
        "password": "a-secure-seed-password-1",
        "full_name": "Seeded Account",
        "phone": f"+91990000000{1 if role == 'ops' else 2}",
    }

    user = _seed_privileged_user(db_session, role, account)
    db_session.commit()

    persisted = db_session.scalar(select(User).where(User.username == account["username"]))
    assert persisted is not None
    assert persisted.id == user.id
    assert persisted.role == role
    assert persisted.society_id is None
    assert persisted.unit_label is None
    assert persisted.password_hash != account["password"]


def test_privileged_seed_will_not_promote_resident(db_session):
    from app.models.domain import Society

    society = Society(name="S", address="A", city="C", invite_code="INVITE")
    resident = User(
        username="resident",
        password_hash="existing-hash",
        full_name="Resident",
        phone="+919900000010",
        role="resident",
        society=society,
        unit_label="A-1",
    )
    db_session.add(resident)
    db_session.commit()

    with pytest.raises(RuntimeError, match="different role"):
        _seed_privileged_user(
            db_session,
            "ops",
            {
                "username": "resident",
                "password": "a-secure-seed-password-1",
                "full_name": "Operator",
                "phone": "+919900000010",
            },
        )
