# Decision log

## 2026-11-15

- **Identifiers:** Use native PostgreSQL UUIDs; SQLAlchemy's portable `Uuid` type also supports local SQLite tests.
- **Status representation:** Use text columns with CHECK constraints instead of PostgreSQL enums to keep future status changes straightforward.
- **Created timestamps:** PostgreSQL defaults use `clock_timestamp()` and UUIDs break join-order ties; do not use transaction-start `now()`.
- **Supabase connection:** Prefer direct connections for long-lived services where IPv6 is available; use the session pooler in IPv4-only environments.
- **Phase 1 test scope:** SQLite tests provide quick local coverage; Postgres-specific constraints, RLS, and migrations must also be tested against real Postgres.
- **Test database:** Use the Supabase development project for PostgreSQL-specific verification scripts that roll back test data; keep production separate.

## 2026-11-16

- **Access-token lifetime:** Use a one-day (1,440-minute) signed access token, as selected by the owner. This is longer than the 30-minute example in the FastAPI tutorial and increases the exposure window for a stolen token; no refresh-token flow is included in the MVP.
- **Authentication implementation:** Hash passwords with Argon2id (`pwdlib`) and issue HS256 JWTs containing only the user subject and standard issue/expiry claims. On every protected request, reload the active user and role from the database; use the shared role dependency rather than token role claims.
- **Auth API and MVP limits:** Public signup creates residents only; login failures are generic 401 responses; phone is collected but remains unverified. OTP, refresh tokens, logout/revocation storage, rate limiting, and account lockout remain out of scope.
- **Phase 2 verification:** Supabase development migration `20261116_0002` passed downgrade to `20261115_0001`, upgrade to head, and `alembic check`; the dev database had zero users before the round-trip. The isolated backend suite passed all 50 tests.
- **Frontend auth implementation:** Implemented the frontend authentication UI in Phase 2 using React 19, Vite, Tailwind CSS design tokens, and React Router v7. Covers Welcome, Login, Resident Signup with auto-uppercase invite codes, client validation, and role-guarded routing.
- **Session & token storage:** Store session tokens in `HttpOnly`, `SameSite=Lax` cookies with signed `X-CSRF-Token` header protection on mutating endpoints, shielding JWTs from XSS while preventing CSRF.
- **Post-signup onboarding:** Initiate chained auto-login upon successful resident registration, falling back to prefilled login with notice if chained authentication fails.
- **Hosting and multi-service deployment:** Configure Vercel Services (`vercel.json`) to deploy both FastAPI backend and Vite frontend as a single deployment, routing `/api/(.*)` to the backend and catch-all `/(.*)` with `/index.html` rewrite to the SPA.
