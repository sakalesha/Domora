# Domora: Architecture Document

| Field | Value |
| --- | --- |
| Version | 1.0 (MVP) |
| Date | 15 Nov 2026 |
| Owner | Sakalesh |
| Status | Approved design; implementation not started |
| Related | PRD.md (requirements), Project Execution Blueprint v1.0 (phases) |

Conventions: DECIDED = agreed. PROPOSED = recommended, needs owner confirmation. UNVERIFIED = depends on
a claim about an external service that has not yet been tested; verify against current docs.

---

## 1. Purpose

This document describes how the MVP is structured and why. It is the reference for design questions
during the build. If code and this document disagree, one of them is wrong: resolve it and update this file.

## 2. Architectural drivers

| Driver | Consequence |
| --- | --- |
| Correctness of money and capacity matters most | Integer paise; transactional bookings; row locking; database constraints as a second line of defence. |
| It is a portfolio project that must be explainable | Few moving parts; every choice has a stated reason and alternative (section 17). |
| Small team of one, weeks of time | Managed Postgres, no scheduler, no message queue, no microservices. |
| Security basics must be real even if the product is not | Central authorization, hashed passwords, private file storage, no secrets in git. |
| Honesty about what is simulated | Mocked or deferred features are documented, not hidden. |

## 3. System context

    Resident / Vendor / Ops (phone or desktop browser)
                  |
                  v
          React + Vite frontend  ---- HTTPS/JSON ---->  FastAPI backend
          (static site, hosted)                         (hosted web service)
                                                          |            |
                                              SQL (Postgres protocol)   HTTPS (storage API)
                                                          |            |
                                                          v            v
                                                  Supabase Postgres   Supabase Storage
                                                  (all business data) (private photo bucket)

Rules: the browser never talks to Supabase directly. Only the backend holds database and storage credentials.

## 4. Technology stack

| Layer | Choice | Why | Main alternative considered |
| --- | --- | --- | --- |
| Frontend | React + Vite, mobile-first | Familiar, fast tooling, installable as a PWA later | Next.js (more than needed) |
| Backend | FastAPI (Python) | Owner's choice; automatic validation and interactive API docs | Express/Node |
| Database | Supabase Postgres, used as plain hosted Postgres | Relational data with constraints and locking | MongoDB (weak fit for linked records) |
| ORM and migrations | SQLAlchemy + Alembic | Versioned schema changes | Raw SQL files |
| File storage | Supabase Storage, private bucket | One vendor; signed links | Photos in the database |
| Authentication | Own JWT auth in the backend | One auth system to reason about | Supabase Auth |
| Tests | pytest against a real Postgres | Locks and partial indexes behave differently on substitutes | SQLite |

Exact library versions are pinned at Phase 0 and recorded in the repository.

## 5. Backend architecture

Layers (a request flows top to bottom; dependencies only point downward):

| Layer | Responsibility | Must not |
| --- | --- | --- |
| Routers (API) | Parse and validate input, call one service function, shape the response, commit | Contain business rules or role checks |
| Dependencies | Identify the caller, enforce role and approval in ONE place, provide the database session | Contain business rules |
| Services | Business rules: pricing, camp state machine, joining, confirming, job steps; own the transaction boundaries | Know about HTTP |
| Models | Table definitions and constraints | Contain logic beyond simple helpers |
| Storage adapter | Save a file, produce a signed link | Be called outside services |
| Core | Configuration, security helpers (hashing, tokens), error types | Depend on other layers |

Errors: services raise typed business errors; one handler in the app turns them into JSON responses.

### 5.1 Proposed repository layout (PROPOSED)

    domora/
      context/            PRD.md, ARCHITECTURE.md, decision log, project log
      backend/
        app/
          api/            routers per area: auth, resident, vendor, ops
          core/           config, security, errors, dependencies
          services/       pricing, camps, bookings, jobs
          models/         tables
          main.py
        migrations/
        tests/
        scripts/          seed
      frontend/
        src/              routes per role, api client, auth state, components

## 6. Data architecture

### 6.1 Conventions (DECIDED unless noted)
- Money: integer paise.
- Time: timestamp with time zone, stored in UTC, displayed in IST. The camp date is derived from the window in IST.
- Identifiers: UUID (DECIDED); stored as native Postgres UUIDs.
- Statuses: text with a CHECK constraint rather than a native enum (DECIDED; easier to migrate).
- Created time: use a real insertion time, not the transaction start time. PostgreSQL defaults use `clock_timestamp()`; the ORM also supplies a UTC insertion timestamp. In Postgres the `now()` function is frozen at the start of a transaction, so rows created in one transaction tie, and join order becomes arbitrary.

### 6.2 Tables (7)

| Table | Key columns | Constraints and notes |
| --- | --- | --- |
| societies | id, name, address, city, invite_code | invite_code unique |
| users | id, username, password_hash, full_name, phone, role (resident, vendor, ops), is_active, society_id, unit_label, created_at | username and phone unique; residents require society and unit; phone unverified; inactive users cannot authenticate |
| services | id, code, name | Seeded: pest_control, ac_service |
| camps | id, society_id, service_id, title, starts_at, ends_at, slot_minutes, min_participants, max_participants, join_deadline, base_price_paise, status, vendor_id, created_by, created_at, cancelled_reason | CHECKs: min at least 1; max at least min; starts_at before ends_at; join_deadline before starts_at; price not negative |
| camp_price_tiers | camp_id, min_participants, discount_pct | Primary key (camp_id, min_participants); discount 0 to 100 |
| bookings | id, camp_id, resident_id, status, quoted_price_paise, final_price_paise, slot_starts_at, created_at, cancelled_at | Partial unique index on (camp_id, resident_id) where status is not cancelled; final price and slot empty until confirmation |
| job_records | id, booking_id, vendor_id, before_photo_path, after_photo_path, started_at, completed_at | booking_id unique; CHECK: an after photo requires a before photo |

Relationships: a society has many users and camps; a camp has one service, one optional vendor (a user),
many tiers and many bookings; a booking belongs to one resident and has at most one job record.

### 6.3 Rules enforced in the database (second line of defence)
One active booking per resident per camp; camp parameter checks; after photo needs before photo; residents
need a society; tier discount range. Application code enforces the same rules first and gives friendly errors.

### 6.4 Row Level Security (UNVERIFIED)
Enable RLS with no policies on every table so Supabase's own auto-generated API cannot read or write
them. The backend connects with a role that bypasses RLS. Verify in Phase 1 by trying to read a table through
the public API with the public key; it must be denied. Every future table needs RLS enabled too.

## 7. State machines

### 7.1 Camp

States: open, confirmed, in_progress, completed, cancelled.

| Transition | Trigger | Precondition |
| --- | --- | --- |
| create to open | Ops | Validation in PRD 8.1 |
| open to confirmed | Ops | Participants at or above minimum; vendor assigned |
| open to cancelled | Ops | Reason required |
| confirmed to cancelled | Ops (reason required) or system (all participants cancelled) | None further |
| confirmed to in_progress | System | First job started |
| in_progress to completed | System | Every non-cancelled booking completed |

### 7.2 Booking

States: joined, scheduled, in_progress, completed, cancelled.

| Transition | Trigger |
| --- | --- |
| (create) to joined | Resident joins an open camp |
| joined to scheduled | Camp confirmed |
| scheduled to in_progress | Vendor uploads before photo |
| in_progress to completed | Vendor uploads after photo |
| joined or scheduled to cancelled | Resident (up to 24h before window) or ops (any time) or camp cancelled |

All transitions go through the service layer. No router or script changes a status directly.

## 8. Key flows

### 8.1 Join a camp
1. Request arrives with a token; the dependency identifies the user and checks the resident role.
2. The service starts a transaction and LOCKS the camp row.
3. It checks: camp belongs to the resident's society; status is open; now is before the deadline; the resident has no active booking; active bookings are below the maximum.
4. It computes the quoted price for the headcount including this resident and inserts the booking.
5. Commit; the lock is released. Return the booking.

### 8.2 Confirm a camp
1. Ops request; role checked; transaction starts; camp row locked.
2. Verify the camp is open, participants are at or above the minimum, and a vendor is assigned.
3. Load active bookings in join order. Compute the discount from the headcount and the final price once.
4. For each booking: set the final price, set the slot start (window start plus position times slot length), set status scheduled.
5. Set the camp to confirmed. Commit.

### 8.3 Vendor starts a job
1. Vendor request with a photo; role checked.
2. Load the booking and its camp; lock the camp. If the camp's vendor is not the caller, respond "not found".
3. Verify the booking is scheduled and the camp is confirmed or in progress.
4. Validate the photo (type identified from content, size limit). Upload to the private bucket under a generated path.
5. Insert the job record with the path, set the booking in progress, set the camp in progress if it is the first. Commit.
Failure note: if the database step fails after the upload, an orphan file remains. Acceptable for the MVP; documented.

### 8.4 Resident signup
Validate input; find the society by invite code (case-insensitive); reject unknown codes; create the resident
with a hashed password; return success. The role is never taken from the request.

## 9. Concurrency and consistency

| Concern | Design |
| --- | --- |
| Overbooking | Every camp or booking change locks the camp row first. Concurrent joins to one camp run one after another; the second sees the first's booking. |
| Double submit | The pre-check plus the partial unique index; the index is the backstop. |
| Deadlocks | Fixed lock order: camp first, then its bookings and records. |
| Atomicity | One transaction per user action; a failure rolls back everything. |
| Join order | Ordered by real insertion time with the UUID as tie-breaker. Never rely on the transaction start time. |
| Two ops confirming at once | The lock serializes them; the second sees the camp already confirmed and is refused. |
| Staleness | After taking the lock, re-read the rows you are about to change. |

Cost: joins to the same camp are serialized. Acceptable at this scale.

## 10. Security architecture

| Area | Design |
| --- | --- |
| Authentication | Username and password; passwords hashed with a vetted slow algorithm (never a fast hash, never custom); signed access tokens with a bounded lifetime. |
| Login behaviour | Same response for unknown user and wrong password; ideally similar timing. |
| Authorization | One central role dependency; ownership checks in services. The caller's role and active state are re-read from the database on every request, not trusted from the token. |
| Resource hiding | Other societies' camps and other users' bookings and jobs return "not found", not "forbidden". |
| Status code policy | 401 not authenticated or bad credentials; 403 wrong role; 404 hidden or missing; 409 business-rule conflict; 422 invalid input. |
| Ops accounts | Created only by the seed script; no endpoint can create them. |
| Secrets | Environment variables only; a startup check refuses default secrets outside development; the service-level storage key never reaches the browser. |
| CORS | Allow only the deployed frontend origin (and local dev). |
| Uploads | Identify the type from content; size limit; generated file names; private bucket; short-lived signed links for viewing. |
| Database exposure | RLS with no policies (UNVERIFIED, see 6.4). |
| Privacy | Residents see participant counts only (default); vendors see only their own jobs' residents. |
| Not in the MVP | Rate limiting, phone verification, audit log, account lockout. Documented limitations. |

## 11. API design

Conventions: REST over JSON; plural nouns; role-scoped prefixes for vendor and ops; errors return a JSON body with a human-readable message; business-rule failures use 409.

| Area | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| Auth | POST /auth/signup | public | Resident signup with invite code |
| Auth | POST /auth/login | public | Returns access token |
| Auth | GET /auth/me | any | Current user |
| Resident | GET /camps | resident | Own society's camps, status filter |
| Resident | GET /camps/{id} | resident | Camp detail with price and tier progress |
| Resident | POST /camps/{id}/join | resident | Join |
| Resident | DELETE /bookings/{id} | resident | Leave (24h rule) |
| Resident | GET /bookings | resident | Own bookings |
| Resident | GET /bookings/{id} | resident | Booking detail with photos |
| Vendor | GET /vendor/jobs | vendor | Own jobs in time order |
| Vendor | POST /vendor/jobs/{booking_id}/start | vendor | Before photo |
| Vendor | POST /vendor/jobs/{booking_id}/complete | vendor | After photo |
| Ops | GET /ops/camps | ops | All camps |
| Ops | GET /ops/camps/{id} | ops | Camp with participants |
| Ops | POST /ops/camps | ops | Create camp with tiers |
| Ops | PATCH /ops/camps/{id}/vendor | ops | Assign or change vendor |
| Ops | POST /ops/camps/{id}/confirm | ops | Confirm |
| Ops | POST /ops/camps/{id}/cancel | ops | Cancel with reason |
| Ops | GET /ops/societies | ops | Reference list for forms |
| Ops | GET /ops/services | ops | Reference list for forms |
| Ops | GET /ops/vendors | ops | Reference list for assignment |

21 endpoints. The last three were missing from the earlier MVP design and are required for the ops forms.
The auto-generated interactive API docs are the live reference during development.

## 12. Photo storage design (UNVERIFIED against the real service)

- One private bucket. The database stores only the path; the path is generated and includes the booking id.
- Upload goes through the backend; the browser never holds a storage key.
- Viewing uses short-lived signed links created on demand when a booking or job is returned.
- Decisions pending (P3): size limit, allowed formats.
- Verify once in Phase 5 against current Supabase Storage docs: upload, signed link creation, expiry.

## 13. Frontend architecture

- Single-page app with routes grouped by role: resident, vendor, ops, plus public login and signup.
- One API client module owns the base address, the token header and error translation; screens never call fetch directly.
- Auth state holds the user and token; route guards redirect by role. Guards are a convenience only; the backend is the real enforcement.
- Token storage trade-offs are decided in Phase 6a (P5).
- Every screen handles loading, empty and error states; 401 sends the user to login; 409 shows the server's reason.
- Mobile-first layout; price labels follow PRD FR-R6.
- Minimal styling first; ops screens stay plain.

## 14. Environments and deployment

| Environment | Database | Notes |
| --- | --- | --- |
| Local development | Own database | Seed script allowed |
| Test | Separate real Postgres (P2) | Tables created and dropped by the test suite; never points at real data |
| Production | Supabase project | Real secrets; seed credentials not reusable |

Configuration names (values never committed): environment name, database URL, token secret, token lifetime,
storage URL, storage service key, bucket name, allowed origins, application time zone.

Process: migrations run before a new backend version starts; a health endpoint exists; the backend refuses to
start with default secrets outside development. Hosting providers are undecided (P4); verify current
free-tier limits, sleep behaviour and database pause rules first. Use the correct Supabase connection type
for migrations versus the running app (check current docs).

## 15. Testing architecture

| Level | Purpose |
| --- | --- |
| Unit | Pricing, tier validation, slot arithmetic, with no database |
| Database | Constraints reject invalid data |
| Integration | Endpoints with real authentication and a real database |
| Concurrency | Many simultaneous joins for the last spot; one user double-submitting; run repeatedly |
| Manual end to end | Demo script at phone width |

Tests use factories for users and camps, clean tables between tests, and never touch non-test databases.

## 16. Observability
Structured request and error logs; business events logged at info level (camp confirmed, job completed);
a health endpoint; no metrics stack in the MVP.

## 17. Architecture decisions

| # | Decision | Alternatives | Rationale | Cost / consequence | Status |
| --- | --- | --- | --- | --- | --- |
| ADR-1 | Relational Postgres | MongoDB | Linked records, constraints, row locks | None meaningful | DECIDED |
| ADR-2 | Own JWT auth | Supabase Auth | One auth system | Owner implements auth | DECIDED |
| ADR-3 | Business rules in a service layer | Rules in routers | Testable, reusable, explainable | Slightly more files | DECIDED |
| ADR-4 | Row lock on the camp for joins | Optimistic retry; serializable isolation | Simple and obviously correct | Joins to one camp serialize | DECIDED |
| ADR-5 | Slots computed at confirmation | Slots table | Fewer tables and constraints | No easy slot swapping; no re-offering freed slots | DECIDED |
| ADR-6 | One price for all, locked at confirmation | Per-joiner price | Simple and fair | No reward for joining first | DECIDED |
| ADR-7 | Manual confirmation by ops | Scheduler at deadline | No scheduler to run or host | Needs ops action | DECIDED |
| ADR-8 | Photos in a private bucket with signed links | Database blobs; public bucket | Small database, privacy | Storage setup; orphan files possible | DECIDED, UNVERIFIED |
| ADR-9 | Database constraints plus code validation | Code only | Defence in depth | Duplicate rule statements | DECIDED |
| ADR-10 | UTC storage, IST display | Local time storage | Avoids time zone bugs | Conversion at the edges | DECIDED |
| ADR-11 | Status as text with CHECK | Native enum | Easier migrations | Slightly weaker typing | PROPOSED |
| ADR-12 | UUID identifiers | Integer ids | Not guessable | Larger indexes | PROPOSED |
| ADR-13 | Camp fields immutable after creation except vendor | Full editing with a draft state | Less state to manage | Cancel and recreate to fix mistakes | PROPOSED (PRD FR-O7) |

## 18. Known limitations and technical debt
- No phone verification; no rate limiting; no audit log; no notifications.
- Slot times are fixed at confirmation; freed slots are not re-offered; overlapping same-day slots across camps are possible.
- One vendor per camp limits camp size.
- Orphan photo files are possible after a failed transaction.
- Provisional price can rise before confirmation (PRD R1, pending).
- Supabase behaviours in sections 6.4, 12 and 14 are unverified.

## 19. Evolution path
OTP verification (adds an OTP table and a verified flag); vendor approval (adds an approval status on
users); RWA role (adds a role value and aggregate-only endpoints); automatic deadline handling (lazy
evaluation on read, then optionally a scheduler); notifications table; slots table when swapping is
needed; audit log; rate limiting at the gateway or in the app.

## 20. Document control

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 15 Nov 2026 | First MVP architecture. |