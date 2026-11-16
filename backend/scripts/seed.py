from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.domain import Service, Society

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


def seed() -> None:
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


if __name__ == "__main__":
    seed()
