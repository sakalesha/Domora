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
   ```

4. Run checks from the repository root:

   ```powershell
   $env:PYTHONPATH = "backend"
   .\.venv\Scripts\python -m pytest backend\tests -q
   ```

The database verification scripts in `backend\scripts` check connectivity, Postgres constraints,
RLS, and public API row visibility. The Postgres constraint checker uses a transaction and rolls
back its test data.

See [the architecture](context/ARCHITECTURE.md) and [the development blueprint](docs/devlopment-blueprintl.md)
for the design and phased plan.
