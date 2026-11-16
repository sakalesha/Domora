# Decision log

## 2026-11-15

- **Identifiers:** Use native PostgreSQL UUIDs; SQLAlchemy's portable `Uuid` type also supports local SQLite tests.
- **Status representation:** Use text columns with CHECK constraints instead of PostgreSQL enums to keep future status changes straightforward.
- **Created timestamps:** PostgreSQL defaults use `clock_timestamp()` and UUIDs break join-order ties; do not use transaction-start `now()`.
- **Supabase connection:** Prefer direct connections for long-lived services where IPv6 is available; use the session pooler in IPv4-only environments.
- **Phase 1 test scope:** SQLite tests provide quick local coverage; Postgres-specific constraints, RLS, and migrations must also be tested against real Postgres.
- **Test database:** Use the Supabase development project for PostgreSQL-specific verification scripts that roll back test data; keep production separate.