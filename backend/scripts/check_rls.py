from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.database import engine

TABLES = (
    "societies",
    "users",
    "services",
    "camps",
    "camp_price_tiers",
    "bookings",
    "job_records",
)


def verify_rls() -> None:
    with engine.connect() as connection:
        rls_tables = set(
            connection.execute(
                text(
                    """
                    SELECT c.relname
                    FROM pg_class AS c
                    JOIN pg_namespace AS n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public'
                      AND c.relkind = 'r'
                      AND c.relrowsecurity
                    """
                )
            ).scalars()
        )
        missing_rls = set(TABLES) - rls_tables
        if missing_rls:
            raise RuntimeError(f"RLS is not enabled on: {', '.join(sorted(missing_rls))}")

        policies = connection.execute(
            text(
                """
                SELECT tablename
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = ANY(:table_names)
                """
            ),
            {"table_names": list(TABLES)},
        ).scalars().all()
        if policies:
            raise RuntimeError(
                "Unexpected RLS policies found on MVP tables: "
                + ", ".join(sorted(set(policies)))
            )

        role_exists = connection.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')")
        ).scalar_one()
        if not role_exists:
            raise RuntimeError("The Supabase anon database role does not exist")

        with connection.begin_nested():
            connection.execute(text("SET LOCAL ROLE anon"))
            for table_name in TABLES:
                try:
                    with connection.begin_nested():
                        rows = connection.execute(
                            text(f'SELECT 1 FROM public."{table_name}" LIMIT 1')
                        ).all()
                        if rows:
                            raise RuntimeError(
                                f"The anon role can read rows from {table_name}"
                            )
                except DBAPIError as error:
                    if getattr(error.orig, "sqlstate", None) != "42501":
                        raise

    print("RLS is enabled with no policies on all seven tables; anon-role reads are denied.")


if __name__ == "__main__":
    verify_rls()
