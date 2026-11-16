# Implementation Plan: Phase 2 — Authentication and Roles

**Date**: 2026-11-16 | **Spec**: [PRD 7.1](../../context/PRD.md#71-accounts-and-access)  
**Design inputs**: [Architecture 5, 8.4, 10, 11](../../context/ARCHITECTURE.md), [Phase 2 blueprint](../devlopment-blueprintl.md#phase-2-authentication-and-roles), [Phase 1 schema](../../backend/app/models/domain.py)

## Summary

Implement resident signup, username/password login, bearer access tokens, `/auth/me`, and centralized database-backed authentication and role dependencies. The backend must never accept a requested role during public signup; ops and vendor accounts are created only by the seed script. Authentication re-reads the user and active state from Postgres for every protected request, keeping authorization decisions current rather than trusting token role claims.

## Technical Context

**Language/Version**: Python 3.11; FastAPI API with Pydantic request/response validation  
**Primary Dependencies**: FastAPI, Uvicorn, SQLAlchemy 2, Alembic, Psycopg 3, PyJWT, `pwdlib[argon2]`  
**Storage**: Supabase Postgres; reuse the `users` and `societies` tables, adding an `is_active` field by migration to support the architecture's per-request active-user check  
**Testing**: pytest; FastAPI TestClient with isolated test database/session overrides for endpoint tests, plus Supabase Postgres for migration and selected database integration checks  
**Target Platform**: Long-running FastAPI web service; Supabase session pooler in IPv4-only environments and direct connection where IPv6 is supported  
**Performance Goals**: No formal latency target; password hashing intentionally uses a slow, vetted algorithm  
**Constraints**: JSON REST API; access-token authentication; integer paise remains unrelated to this phase; no Supabase Auth, phone OTP, refresh tokens, account lockout, or public vendor/ops registration. The real `.env` must remain ignored.

## Constitution Check

No project `constitution.md` was found. Check against the approved PRD and architecture instead:

| Principle | Result | Plan alignment |
|---|---|---|
| Authorization is enforced by the backend | PASS | Reusable current-user and role dependencies protect every protected router. |
| Caller role/state is not trusted from a token | PASS | Token identifies the user; database is re-read on each protected request. |
| Use vetted password hashing and signed, expiring tokens | PASS | Argon2id through `pwdlib`; allow-listed HS256 access tokens with bounded expiry. |
| Ops/vendor cannot self-register; role is not client input | PASS | Signup schema has no role; seed script owns privileged account creation. |
| Keep secrets out of source control | PASS | Use environment configuration; fail startup outside development if the secret is missing/default. |
| Honest MVP limits | PASS | Phone remains unverified; no OTP, refresh tokens, or account lockout are introduced. |

## Applied Guidelines

- **Guideline lookup**: No matching top-level migration/transformation guideline exists for a new FastAPI/Python auth implementation. Follow the project architecture and the official [FastAPI OAuth2/JWT guidance](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) for PyJWT and `pwdlib` with Argon2. The owner selected a one-day access-token lifetime; the tutorial's shorter expiry is not used. This plan does not apply the unrelated Struts-to-Spring migration guideline.

## Implementation Steps

### Step 1: [Cross-cutting] Add auth runtime foundation
- **Requirements**: REQ-002, REQ-003, REQ-005
- **Design inputs**: Architecture sections 5, 10, 11; existing `backend/app/core/config.py`, `backend/app/core/database.py`, and `backend/app/models/domain.py`
- **Description**: Add and pin the FastAPI/Uvicorn, PyJWT, and `pwdlib[argon2]` dependencies. Add a reversible migration adding `users.is_active BOOLEAN NOT NULL DEFAULT TRUE`; keep the SQLAlchemy model and migration aligned. Extend configuration with the owner-selected 24-hour access-token lifetime and strict production secret validation. Create the FastAPI application entry point and router registration without mixing business rules into route handlers.

#### Tasks
- [X] T001 [Plan:1.1] Add pinned FastAPI, Uvicorn, PyJWT, `pwdlib[argon2]`, and HTTPX2 TestClient dependencies in `backend/requirements.txt`.
- [X] T002 [Plan:1.1] Add the `is_active` user field in `backend/app/models/domain.py` and create an Alembic migration under `backend/migrations/versions/` with reversible upgrade/downgrade operations.
- [X] T003 [Plan:1.1] Add a one-day JWT expiry configuration and production-only rejection of missing/default `SECRET_KEY` values in `backend/app/core/config.py`.
- [X] T004 [Plan:1.2] Create the FastAPI app factory and lifespan/config validation in `backend/app/main.py`; register routers and expose a simple health endpoint.
- [X] T005 [Plan:1.2] Add API package/router scaffolding under `backend/app/api/` and use FastAPI database-session dependency overrides in `backend/tests/conftest.py`.

### Step 2: [US1] Implement resident signup and login
- **Requirements**: REQ-001, REQ-002, REQ-004, REQ-006
- **Design inputs**: PRD FR-A1, FR-A2, FR-A4, FR-A6; Architecture sections 8.4, 10, 11
- **Description**: Implement strict request/response schemas, case-insensitive invite-code lookup, password hashing/verification, token issue/verification helpers, signup, login, and seed-only creation of ops/vendor accounts. Signup accepts only resident fields; it does not accept or return password hashes. Return the created user summary from signup and require the separate login request for a token.

#### Tasks
- [X] T006 [Plan:2.1] Add password hash/verify and JWT issue/decode helpers in `backend/app/core/security.py` using Argon2id and an explicit HS256 allow-list.
- [X] T007 [Plan:2.2] Define signup, login, token, and safe user response schemas in `backend/app/api/auth_schemas.py`; prohibit role input and exclude password hashes from serialization.
- [X] T008 [Plan:2.2] Implement auth service operations in `backend/app/services/auth.py`: normalize invite-code lookup case-insensitively, create only resident users, authenticate usernames, and return a generic failure for unknown username or wrong password.
- [X] T009 [Plan:2.2] Expand `backend/scripts/seed.py` to create ops/vendor accounts only from explicit environment configuration, hashing passwords and refusing insecure hard-coded/default credentials.
- [X] T010 [Plan:2.3] Implement `POST /auth/signup` and `POST /auth/login` in `backend/app/api/auth.py`; map invalid invite data to 422, duplicate username/phone to 409, bad credentials to a uniform 401 with `WWW-Authenticate: Bearer`, and commit/rollback writes reliably.
- [X] T011 [Plan:2.3] Register auth routes in `backend/app/api/router.py` (included by `backend/app/main.py`) and document phone as collected but unverified in the API response/docs or README.

### Step 3: [US2] Add database-backed identity and role authorization
- **Requirements**: REQ-003, REQ-005
- **Design inputs**: PRD FR-A3, FR-A5; Architecture sections 5, 10, 11
- **Description**: Use the token subject only to locate the caller. On every protected request, query the user row, reject missing/inactive accounts, and apply one reusable role dependency. Implement `/auth/me` as the first protected endpoint; later resident/vendor/ops routers must reuse these dependencies. Keep ownership checks in their resource services as those endpoints are delivered in later phases.

#### Tasks
- [X] T012 [Plan:3.1] Implement a bearer-token current-user dependency in `backend/app/core/dependencies.py` that validates signature/expiry, loads the current user from the database, and returns 401 for missing, invalid, expired, unknown, or inactive users.
- [X] T013 [Plan:3.2] Add a reusable role requirement dependency in `backend/app/core/dependencies.py` that returns 403 for authenticated callers with the wrong role.
- [X] T014 [Plan:3.3] Implement `GET /auth/me` in `backend/app/api/auth.py` returning only the caller's safe profile fields, including role and society identity/display details.

### Step 4: [Cross-cutting] Verify auth behavior and document operational limits
- **Requirements**: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006
- **Design inputs**: PRD acceptance criteria AC-11, AC-12; Phase 2 tests and exit gate in the development blueprint
- **Description**: Test the actual HTTP boundary and security failure cases, keeping database tests isolated. Verify role fields cannot be escalated through signup, ops/vendor creation has no public path, and profile access is always derived from the authenticated user. Update the run instructions and phase tracker only after the checks pass.

#### Tasks
- [X] T015 [Plan:4.1] Add focused tests for password hashing, generic credential failure, JWT signature/expiry validation, and disallowed algorithms in `backend/tests/test_security.py` and `backend/tests/test_auth_api.py`.
- [X] T016 [Plan:4.1] Add FastAPI endpoint tests in `backend/tests/test_auth_api.py` for successful signup/login/profile, wrong invite, duplicate username/phone, missing/invalid/expired token, 401/403 behavior, role escalation attempts, and password-hash non-disclosure.
- [X] T017 [Plan:4.1] Add database tests proving a user's role/active state changes take effect on the next request, using the test-session fixture and the `is_active` migration.
- [X] T018 [Plan:4.1] Verify Alembic upgrade/downgrade/upgrade on the PostgreSQL development database, run the focused test suite, and document exact commands/results in `README.md`.
- [X] T019 [Plan:4.1] Update `docs/devlopment-blueprintl.md` and `docs/decision-log.md` with auth decisions, passing tests, and the explicit phone-unverified/no-refresh-token limitations.

## Project Structure

```text
backend/
  app/
    api/
      __init__.py
      auth.py
      auth_schemas.py
    core/
      config.py
      database.py
      dependencies.py
      security.py
    models/
      domain.py
    services/
      auth.py
    main.py
  migrations/
    versions/
      <add-user-active-state>.py
  scripts/
    seed.py
  tests/
    test_auth_api.py
    test_security.py
    test_schema.py
  requirements.txt
```

## Testing Strategy

- **appType**: JSON REST API.
- **Critical user journeys**:
  1. Resident signs up with valid society invite code and profile fields; persisted user is a resident with hashed password and unverified phone.
  2. Unknown invite code is refused; duplicate username or phone is refused without leaking database errors.
  3. Resident and seeded ops/vendor accounts log in and receive signed, expiring bearer tokens.
  4. Authenticated user fetches only their own `/auth/me` profile; missing/invalid/expired tokens get 401.
  5. Authenticated caller with wrong role gets 403; changing role or active state in the database affects the next request.
  6. Public signup cannot create or elevate to ops/vendor; privileged accounts are seeded only.
- **primaryValidationStack**: pytest, FastAPI TestClient, SQLAlchemy session overrides, Supabase PostgreSQL/Alembic for migration verification.
- **fallbackMatrix**:
  - `infra-tier`: Supabase development PostgreSQL → isolated SQLite for endpoint/security tests only. PostgreSQL migration and role/RLS behavior must still be checked against Supabase.
  - `browser-tier`: not applicable; no browser UI is in Phase 2.
- **Environment requirements**: Python 3.11+, pinned backend dependencies, `.env` with test/development settings; Supabase development credentials for migration validation. Never use production as a test database.
- **knownGaps**: The owner-selected 24-hour expiry increases the exposure window for a stolen bearer token. No phone OTP/verification, refresh-token flow, logout/revocation store, rate limiting, or account lockout. Deactivating a user blocks their token on the next request because each request re-reads `is_active`.
- **Test data strategy**: Use isolated test database sessions and deterministic fixture records; use UUIDs for seeded test identities; rollback or clean up all Supabase verification data.
- **Acceptance criteria**: Every journey above has a focused passing test; signup cannot accept role; login failures are indistinguishable by response; unauthorized requests return 401, wrong-role requests 403; `/auth/me` exposes neither password hash nor another user's data.
- **Validation review expectations**: Confirm migration/model parity, no secrets/default production key, no route-local role checks, DB-backed user-state reads, consistent error statuses, and no response containing password hashes.

## Requirement Mapping

| REQ ID | Source requirement | Description | Plan Items | Implementation Evidence |
|--------|-------------------|-------------|------------|------------------------|
| REQ-001 | PRD FR-A1 | Resident signup requires username, password, name, phone, unit, and a valid invite code. | 1.1, 2.2, 2.3, 4.1 | `backend/app/api/auth_schemas.py`, `backend/app/services/auth.py`, `backend/app/api/auth.py`, `backend/tests/test_auth_api.py` |
| REQ-002 | PRD FR-A2 | Username/password login returns a signed access token. | 1.1, 2.1, 2.2, 2.3, 4.1 | `backend/app/core/security.py`, `backend/app/services/auth.py`, `backend/app/api/auth.py`, `backend/tests/test_security.py` |
| REQ-003 | PRD FR-A3 | Logged-in user can fetch their own role/society profile. | 1.2, 3.1, 3.3, 4.1 | `backend/app/core/dependencies.py`, `backend/app/api/auth.py`, `backend/tests/test_auth_api.py` |
| REQ-004 | PRD FR-A4 | Ops/vendor accounts can only be created by the seed script. | 2.2, 2.3, 4.1 | `backend/scripts/seed.py`, signup schemas/routes, `backend/tests/test_auth_api.py` |
| REQ-005 | PRD FR-A5 | Every protected endpoint enforces backend authentication, role, and resource ownership. Phase 2 supplies shared auth/role enforcement; resource ownership is applied by later resource services. | 1.1, 1.2, 3.1, 3.2, 3.3, 4.1 | `backend/app/core/dependencies.py`, `/auth/me`, protected-route tests, later resident/vendor/ops routers and services |
| REQ-006 | PRD FR-A6 | Phone is collected but explicitly unverified in the MVP. | 2.2, 2.3, 4.1 | Signup schema/service, safe profile response, `README.md`, `backend/tests/test_auth_api.py` |
