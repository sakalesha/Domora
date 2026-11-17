from __future__ import annotations

import os
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.core.security import hash_password
from app.models.domain import Service, Society, User

SOCIETY = {
    "name": "Sunrise Heights",
    "address": "1 Main Road",
    "city": "Bengaluru",
    "invite_code": "SUNRISE-DEMO",
}
SERVICES = (
    ("pest_control", "Pest control"),
    ("ac_service", "AC servicing"),
)
_PRIVILEGED_ACCOUNT_FIELDS = ("USERNAME", "PASSWORD", "FULL_NAME", "PHONE")
_INSECURE_PASSWORDS = {"password1234", "changeme12345", "change-me-in-production"}


def _read_privileged_account(role: Literal["ops", "vendor"]) -> dict[str, str] | None:
    prefix = f"SEED_{role.upper()}_"
    values = {field.lower(): os.getenv(f"{prefix}{field}") for field in _PRIVILEGED_ACCOUNT_FIELDS}
    if all(value is None or value == "" for value in values.values()):
        return None

    missing = [field for field, value in values.items() if value is None or value == ""]
    if missing:
        raise RuntimeError(f"{prefix} configuration must provide all account fields")

    account = {field: value or "" for field, value in values.items()}
    account["username"] = account["username"].strip()
    account["full_name"] = account["full_name"].strip()
    account["phone"] = account["phone"].strip()
    password = account["password"]

    if not account["username"] or not account["full_name"] or not account["phone"]:
        raise RuntimeError(f"{prefix} username, full name, and phone cannot be blank")
    if (
        len(account["username"]) > 80
        or len(account["full_name"]) > 150
        or len(account["phone"]) > 30
    ):
        raise RuntimeError(f"{prefix} account fields exceed the supported length")
    if (
        len(password) < 12
        or password.strip() != password
        or password.casefold() == account["username"].casefold()
        or password.casefold() in _INSECURE_PASSWORDS
    ):
        raise RuntimeError(f"{prefix} password must be a non-default value of at least 12 characters")
    return account


def _seed_privileged_user(
    session: Session,
    role: Literal["ops", "vendor"],
    account: dict[str, str],
) -> User:
    existing_user = session.scalar(select(User).where(User.username == account["username"]))
    if existing_user is not None and existing_user.role != role:
        raise RuntimeError(f"Refusing to change account {account['username']} from a different role")

    phone_owner = session.scalar(
        select(User).where(
            User.phone == account["phone"],
            User.username != account["username"],
        )
    )
    if phone_owner is not None:
        raise RuntimeError(f"Phone number for seeded {role} account is already assigned")

    if existing_user is None:
        existing_user = User(
            username=account["username"],
            password_hash=hash_password(account["password"]),
            full_name=account["full_name"],
            phone=account["phone"],
            role=role,
            society_id=None,
            unit_label=None,
        )
        session.add(existing_user)
    else:
        existing_user.password_hash = hash_password(account["password"])
        existing_user.full_name = account["full_name"]
        existing_user.phone = account["phone"]
        existing_user.society_id = None
        existing_user.unit_label = None

    session.flush()
    return existing_user


def seed() -> None:
    accounts = {
        role: account
        for role in ("ops", "vendor")
        if (account := _read_privileged_account(role)) is not None
    }

    with SessionLocal.begin() as session:
        society = session.scalar(
            select(Society).where(Society.invite_code == SOCIETY["invite_code"])
        )
        if society is None:
            session.add(Society(**SOCIETY))

        for code, name in SERVICES:
            service = session.scalar(select(Service).where(Service.code == code))
            if service is None:
                session.add(Service(code=code, name=name))

        for role, account in accounts.items():
            _seed_privileged_user(session, role, account)


if __name__ == "__main__":
    seed()
