# Domora

Domora is a portfolio MVP for coordinating group bookings of home services within a residential
society. Residents join a service camp, the group price changes with participation, and a vendor
records before/after photos. Payments, phone verification, and notifications are not part of this MVP.

## Stack

- React + Vite frontend
- FastAPI backend
- Supabase Postgres, accessed by the backend with SQLAlchemy
- Alembic schema migrations

## Backend setup

Requires Python 3.11 or later and a Supabase Postgres project.

1. Create a virtual environment and install dependencies:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python -m pip install -r backend\requirements.txt
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SECRET_KEY`, `APP_ENV`,
   `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. Keep `.env` private and never commit it. For an
   IPv4-only network, use the Supabase session-pooler connection string copied from the dashboard.

3. Run backend commands from `backend`:

   ```powershell
   $env:PYTHONPATH = "."
   ..\.venv\Scripts\python -m alembic upgrade head
   ..\.venv\Scripts\python -m scripts.seed
   ..\.venv\Scripts\python -m uvicorn app.main:app --reload
   ```

4. Run checks from the repository root:

   ```powershell
   $env:PYTHONPATH = "backend"
   .\.venv\Scripts\python -m pytest backend\tests -q
   ```

For the migration round-trip, point the private `.env` at the Supabase **development** database,
then run from `backend`:

```powershell
$env:PYTHONPATH = "."
..\.venv\Scripts\python -m alembic current
..\.venv\Scripts\python -m alembic downgrade 20261115_0001
..\.venv\Scripts\python -m alembic upgrade head
..\.venv\Scripts\python -m alembic current
..\.venv\Scripts\python -m alembic check
```

The Phase 2 migration round-trip completed on the development database: revision
`20261116_0002` was current afterward and `alembic check` reported no pending operations. The
database had no user rows before the check. The downgrade drops `users.is_active`; do not run this
round-trip on production or a database with account-state data that must be preserved. The final
backend suite result was **42 passed** (`pytest backend\tests -q` from the repository root with
`PYTHONPATH=backend`).

The database verification scripts in `backend\scripts` check connectivity, Postgres constraints,
RLS, and public API row visibility. The Postgres constraint checker uses a transaction and rolls
back its test data.

Access tokens are configured for 24 hours by default (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`); use
environment configuration to change this value. This longer duration increases risk if a bearer
token is stolen.

Resident signup is available at `POST /auth/signup`, and username/password login at
`POST /auth/login`. Authenticated callers can fetch their own safe profile and society display
details from `GET /auth/me` with a bearer token. Each protected request reloads account state and
role from the database. Signup reports `phone_verified: false`; phone verification is not part of
the MVP. Ops and vendor accounts are never created by public signup. To seed either account, set
all four `SEED_OPS_*` or `SEED_VENDOR_*` variables in the private `.env` (`USERNAME`, `PASSWORD`,
`FULL_NAME`, and `PHONE`) before running the seed command. Seed passwords must be at least 12
characters and are hashed before storage; omit these variables when no privileged account is
needed.

See [the architecture](context/ARCHITECTURE.md) and [the development blueprint](docs/devlopment-blueprintl.md)
for the design and phased plan.
