from __future__ import annotations

from sqlalchemy import text

from app.database import engine


def check_database() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    print("Database connection succeeded.")


if __name__ == "__main__":
    check_database()
