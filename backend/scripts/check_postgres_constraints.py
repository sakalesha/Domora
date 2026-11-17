from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.database import engine


def _expect_integrity_error(connection, statement: str, values: dict[str, object]) -> None:
    try:
        with connection.begin_nested():
            connection.execute(text(statement), values)
    except IntegrityError:
        return
    raise AssertionError(f"Postgres accepted invalid data: {statement}")


def verify_constraints() -> None:
    prefix = uuid.uuid4().hex
    society_id = str(uuid.uuid4())
    service_id = str(uuid.uuid4())
    resident_id = str(uuid.uuid4())
    camp_id = str(uuid.uuid4())
    booking_id = str(uuid.uuid4())
    rejoin_booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(days=2)
    ends_at = starts_at + timedelta(hours=6)
    join_deadline = starts_at - timedelta(days=1)

    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(
                text(
                    """
                    INSERT INTO societies (id, name, address, city, invite_code)
                    VALUES (:id, 'Schema Check', '1 Test Road', 'Bengaluru', :invite_code)
                    """
                ),
                {"id": society_id, "invite_code": f"CHECK-{prefix}"},
            )
            connection.execute(
                text("INSERT INTO services (id, code, name) VALUES (:id, :code, 'Schema Check')"),
                {"id": service_id, "code": f"check_{prefix}"},
            )
            _expect_integrity_error(
                connection,
                """
                INSERT INTO users (id, username, password_hash, full_name, phone, role)
                VALUES (:id, :username, 'hash', 'Invalid Resident', :phone, 'resident')
                """,
                {
                    "id": str(uuid.uuid4()),
                    "username": f"invalid_{prefix}",
                    "phone": f"+100{prefix[:10]}",
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO users
                        (id, username, password_hash, full_name, phone, role, society_id, unit_label)
                    VALUES
                        (:id, :username, 'hash', 'Schema Resident', :phone, 'resident', :society_id, 'A-1')
                    """
                ),
                {
                    "id": resident_id,
                    "username": f"resident_{prefix}",
                    "phone": f"+200{prefix[:10]}",
                    "society_id": society_id,
                },
            )

            def insert_camp(
                *,
                camp_id_value: str,
                start: datetime = starts_at,
                end: datetime = ends_at,
                deadline: datetime = join_deadline,
                minimum: int = 3,
                maximum: int = 10,
                slot_minutes: int = 30,
                price: int = 80000,
            ) -> None:
                connection.execute(
                    text(
                        """
                        INSERT INTO camps (
                            id, society_id, service_id, title, starts_at, ends_at,
                            slot_minutes, min_participants, max_participants, join_deadline,
                            base_price_paise, status
                        ) VALUES (
                            :id, :society_id, :service_id, 'Schema Check Camp', :starts_at, :ends_at,
                            :slot_minutes, :minimum, :maximum, :join_deadline, :price, 'open'
                        )
                        """
                    ),
                    {
                        "id": camp_id_value,
                        "society_id": society_id,
                        "service_id": service_id,
                        "starts_at": start,
                        "ends_at": end,
                        "slot_minutes": slot_minutes,
                        "minimum": minimum,
                        "maximum": maximum,
                        "join_deadline": deadline,
                        "price": price,
                    },
                )

            insert_camp(camp_id_value=camp_id)
            invalid_camps = (
                {"end": starts_at - timedelta(minutes=1)},
                {"deadline": starts_at + timedelta(minutes=1)},
                {"minimum": 0},
                {"maximum": 2},
                {"slot_minutes": 0},
                {"price": -1},
            )
            for overrides in invalid_camps:
                values = {
                    "camp_id_value": str(uuid.uuid4()),
                    "start": starts_at,
                    "end": ends_at,
                    "deadline": join_deadline,
                    "minimum": 3,
                    "maximum": 10,
                    "slot_minutes": 30,
                    "price": 80000,
                }
                values.update(overrides)
                try:
                    with connection.begin_nested():
                        insert_camp(**values)
                except IntegrityError:
                    continue
                raise AssertionError(f"Postgres accepted invalid camp values: {overrides}")

            _expect_integrity_error(
                connection,
                """
                INSERT INTO camp_price_tiers (camp_id, min_participants, discount_pct)
                VALUES (:camp_id, 3, 101)
                """,
                {"camp_id": camp_id},
            )
            connection.execute(
                text(
                    """
                    INSERT INTO bookings (id, camp_id, resident_id, status, quoted_price_paise)
                    VALUES (:id, :camp_id, :resident_id, 'joined', 80000)
                    """
                ),
                {"id": booking_id, "camp_id": camp_id, "resident_id": resident_id},
            )
            _expect_integrity_error(
                connection,
                """
                INSERT INTO bookings (id, camp_id, resident_id, status, quoted_price_paise)
                VALUES (:id, :camp_id, :resident_id, 'joined', 80000)
                """,
                {
                    "id": str(uuid.uuid4()),
                    "camp_id": camp_id,
                    "resident_id": resident_id,
                },
            )
            connection.execute(
                text("UPDATE bookings SET status = 'cancelled' WHERE id = :id"),
                {"id": booking_id},
            )
            connection.execute(
                text(
                    """
                    INSERT INTO bookings (id, camp_id, resident_id, status, quoted_price_paise)
                    VALUES (:id, :camp_id, :resident_id, 'joined', 80000)
                    """
                ),
                {
                    "id": rejoin_booking_id,
                    "camp_id": camp_id,
                    "resident_id": resident_id,
                },
            )
            _expect_integrity_error(
                connection,
                """
                INSERT INTO job_records (id, booking_id, vendor_id, after_photo_path)
                VALUES (:id, :booking_id, :vendor_id, 'after.jpg')
                """,
                {
                    "id": str(uuid.uuid4()),
                    "booking_id": rejoin_booking_id,
                    "vendor_id": resident_id,
                },
            )
        finally:
            transaction.rollback()

    print("Postgres rejected all tested invalid states; verification transaction was rolled back.")


if __name__ == "__main__":
    verify_constraints()
