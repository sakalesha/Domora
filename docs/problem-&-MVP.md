# Domora: Problem Statement and MVP Design

Version 1.0 draft, 13 Nov 2026. Author: Sakalesh (portfolio project).

---

## Part 1: Problem Statement

### 1.1 Context

People who live in the same apartment building or gated community regularly need the same home
services at the same time: pest control, preventive AC servicing before summer, water purifier
servicing, cleaning. Today each household books alone.

### 1.2 The problem

| Who | What goes wrong today |
| --- | --- |
| Residents | Pay full price per household, wait for a slot that suits the provider, and often take time off to be at home. |
| Service providers (vendors) | Spend a large share of the day travelling between far-apart homes, so they complete fewer jobs and earn less per hour worked. |
| Neighbours / society | Need the same service at the same time but have no simple way to coordinate, so the building sees many scattered visits instead of one organised one. |

### 1.3 Why it persists

Booking platforms are built around one customer and one visit. Nothing in the booking flow lets
neighbours see each other's demand, pool it, and trade volume for a lower price.

### 1.4 Proposed idea (a hypothesis, not a proven fact)

Let residents of one society join a **camp**: one service, one day, one vendor. The more neighbours
join, the bigger the discount. The vendor visits many homes in one building in a single day, so
travel time drops, and the saving is shared with residents through the discount.

### 1.5 Assumptions that are NOT yet validated

| # | Assumption | Status |
| --- | --- | --- |
| A1 | Enough neighbours want the same service in the same window to reach a minimum group size. | Validated |
| A2 | Vendors will accept a lower per-home price in exchange for volume and less travel. | Validated |
| A3 | Residents will trust a platform and a vendor they have not chosen themselves. | Validated |
| A4 | The discount tiers used in this project (for example 10/15/20 percent) are viable for vendors. | Illustrative numbers only |

### 1.5.1 Statement of the problem to solve

> Households in the same building pay full price and arrange visits separately for the same home
> services, while vendors lose hours travelling between scattered homes. Domora lets a society book
> a service together on one day, with a group discount that grows with participation, so residents
> pay less and vendors do more jobs per day.

### 1.6 Goals and non-goals of this project

**Goals**
- Demonstrate the complete idea as a working product, from problem to live demo.
- Show sound engineering: a correct booking and pricing model, safe concurrent booking, role-based
  access, and honest documentation of what is mocked.

**Non-goals**
- Not a launched business. No real payments, no real customers, no real SMS.
- Not market validation (see 1.5).

### 1.7 MVP success criteria

1. The demo script in section 2.3 runs end to end in a browser in under 5 minutes.
2. Pricing and overbooking are covered by automated tests, including two simultaneous joins for the last spot.
3. Deployed at a public URL with seeded demo data.
4. The README states plainly what is simulated.

---

## Part 2: MVP Scope

### 2.1 In scope

| Role | Can do in the MVP |
| --- | --- |
| Resident | Sign up with a society invite code, log in, browse camps of their own society, join and leave, see the current price and tier progress, see their booking, time slot and job photos. |
| Vendor | Log in (account created by ops), see assigned jobs in time order, start a job with a before photo, complete it with an after photo. |
| Ops | Log in (seeded account), create camps with price tiers, assign the vendor, confirm or cancel a camp, see participants. |

### 2.2 Deferred (not removed)

| Deferred item | Why it is safe to defer |
| --- | --- |
| Phone OTP verification | Trust feature; does not change the core logic. Phone is collected but UNVERIFIED in the MVP. |
| Vendor self-signup with ops approval | MVP: ops creates vendor accounts. Add approval flow after the core slice works. |
| RWA (society committee) dashboard | Read-only view; easy to add later. |
| Notifications, audit log | Nothing in the core flow depends on them. |
| Draft camp state, automatic confirm/cancel at the deadline | MVP: ops creates a camp as open and confirms it manually. |
| Separate slots table and slot swapping | MVP computes each time slot at confirmation. |
| No-show handling, vendor-to-service validation | Edge cases; list as known gaps. |
| PWA install and offline support | Polish. |

### 2.3 The demo script (the one story the MVP must tell)

Setup: society "Sunrise Heights", service "Pest control". Base price Rs 800. Window 10:00 to 16:00,
30-minute visits, minimum 3 homes. Tiers (illustrative): 3 homes = 10%, 6 homes = 15%, 10 homes = 20%.

1. Ops logs in, creates the camp, and assigns a vendor.
2. Resident A signs up using the society invite code, opens the camp, and sees "Rs 800 now,
   3 neighbours needed for 10% off". A joins.
3. Residents B and C join. The screen now shows 3 joined, Rs 720, "3 more neighbours for 15% off".
4. Ops confirms the camp. Each booking gets the locked price (Rs 720) and a time: 10:00, 10:30, 11:00.
5. The vendor logs in, sees three jobs in order, starts the first with a before photo, and
   completes it with an after photo.
6. Resident A opens "My bookings" and sees the booking completed, with both photos.

---

## Part 3: MVP Solution Design

### 3.1 Core concepts

| Term | Meaning |
| --- | --- |
| Society | A building or gated community. Residents belong to exactly one, identified by an invite code. |
| Camp | One service on one day for one society, served by one vendor, with a time window, capacity, minimum group size and price tiers. |
| Price tier | "At N or more homes, discount is P percent". |
| Booking | One resident's participation in one camp. |
| Job record | The vendor's proof of work for one booking: before and after photos. |

### 3.2 Camp lifecycle

States: `open` -> `confirmed` -> `in_progress` -> `completed`. `cancelled` is reachable from `open` and `confirmed`.

| Transition | Who | Precondition |
| --- | --- | --- |
| (create) -> open | Ops | Valid window, capacity, tiers, and join deadline at least 24h before the window starts. |
| open -> confirmed | Ops | Participants >= minimum AND a vendor is assigned. Locks prices and assigns time slots. |
| open / confirmed -> cancelled | Ops | A reason is required. All active bookings are cancelled. |
| confirmed -> in_progress | System | The first job is started by the vendor. |
| in_progress -> completed | System | Every non-cancelled booking is completed. |
| confirmed -> cancelled | System | All participants cancelled (otherwise the camp would stay confirmed forever). |

### 3.3 Booking lifecycle

`joined` -> `scheduled` (camp confirmed) -> `in_progress` (before photo uploaded) -> `completed` (after photo uploaded).
`cancelled` is reachable from `joined` and `scheduled`.

Residents may cancel up to 24 hours before the camp window starts. Ops may cancel at any time.

### 3.4 Pricing rule

- Each camp has a `base_price_paise` and a list of tiers.
- The discount is the highest tier whose headcount has been reached; below the lowest tier it is 0%.
- While the camp is open, the displayed price is **provisional**: it follows the current headcount.
- At confirmation, the final price is computed once from the headcount and applied to **everyone** equally.
- After confirmation the price is locked. Later cancellations never re-price other residents.
- Money is stored as integer paise (never floats). Round half up.
- Validation: tier headcounts strictly increase and discounts never decrease as headcount grows.

### 3.5 Scheduling rule

- Capacity = number of whole slots in the window (for example 10:00 to 16:00 in 30-minute slots = 12).
- Maximum participants must not exceed capacity.
- At confirmation, bookings are ordered by join time and given consecutive slots from the window start.
- One vendor per camp; visits are sequential and fixed length.
- Trade-off: no easy slot swapping in the MVP; a camp is limited to roughly 12 to 18 homes.

**Watch out:** Postgres `now()` returns the time the *transaction started*, so rows created in one
transaction can tie. If join order decides slots, order by a real insertion time (`clock_timestamp()`),
with the row id as a tie-breaker, or store an explicit join sequence number.

### 3.6 Business rules (each one should have a test)

1. A resident has at most one active booking per camp (cancelled bookings do not count; re-joining is allowed).
2. Active bookings never exceed the camp's maximum, even when two residents join at the same instant.
3. A resident can only see and join camps of their own society.
4. A final price is set exactly once and never changes afterwards.
5. A camp can be confirmed only with enough participants and an assigned vendor.
6. A job cannot be completed without a before photo (enforce in code AND with a database check).
7. Only the assigned vendor can act on a camp's jobs.
8. Only ops can create, confirm or cancel camps. Ops accounts are never self-registered.
9. Joining closes at the join deadline.

### 3.7 Architecture

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React + Vite (installable PWA later) | Three role-based areas: resident, vendor, ops. |
| Backend | FastAPI (Python) | Business rules live in a service layer, not in route handlers. |
| Database | Supabase Postgres | Used purely as a hosted Postgres. |
| File storage | Supabase Storage (private bucket) | Database stores only the file path; photos are shown via short-lived signed URLs. |
| Auth | Own JWT auth in FastAPI | Not Supabase Auth, to avoid two auth systems. |
| Migrations | Alembic | Schema changes are versioned. |

Security note: Supabase can expose tables directly through its own API. Enable Row Level Security
with no policies on every table, so only your backend can touch the data.

### 3.8 Data model (7 tables)

| Table | Key columns | Constraints and notes |
| --- | --- | --- |
| `societies` | id, name, address, city, invite_code | invite_code unique. |
| `users` | id, username, password_hash, full_name, phone, role (resident / vendor / ops), society_id, unit_label, created_at | username and phone unique. Residents must have a society and unit. Phone is unverified in the MVP. |
| `services` | id, code, name | Seed: pest_control, ac_service. |
| `camps` | id, society_id, service_id, title, starts_at, ends_at, slot_minutes, min_participants, max_participants, join_deadline, base_price_paise, status, vendor_id, created_by, created_at, cancelled_reason | Checks: min >= 1, max >= min, starts_at < ends_at, join_deadline < starts_at, price >= 0. Times stored with timezone. |
| `camp_price_tiers` | camp_id, min_participants, discount_pct | Primary key (camp_id, min_participants). Discount between 0 and 100. |
| `bookings` | id, camp_id, resident_id, status, quoted_price_paise, final_price_paise, slot_starts_at, created_at, cancelled_at | Partial unique index on (camp_id, resident_id) where status is not cancelled. final_price and slot are empty until confirmation. |
| `job_records` | id, booking_id, vendor_id, before_photo_path, after_photo_path, started_at, completed_at | booking_id unique. Check: an after photo requires a before photo. |

### 3.9 API (MVP, about 17 endpoints)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup` (resident, needs invite code), `POST /auth/login`, `GET /auth/me` |
| Resident | `GET /camps`, `GET /camps/{id}`, `POST /camps/{id}/join`, `DELETE /bookings/{id}`, `GET /bookings`, `GET /bookings/{id}` |
| Vendor | `GET /vendor/jobs`, `POST /vendor/jobs/{booking_id}/start` (before photo), `POST /vendor/jobs/{booking_id}/complete` (after photo) |
| Ops | `GET /ops/camps`, `GET /ops/camps/{id}` (with participants), `POST /ops/camps`, `PATCH /ops/camps/{id}/vendor`, `POST /ops/camps/{id}/confirm`, `POST /ops/camps/{id}/cancel` |

Role and ownership checks live in ONE place (a dependency), never scattered inside route bodies.
Societies, services and ops/vendor accounts are created by a seed script in the MVP.

### 3.10 Screens

**Resident:** sign up and log in; camp list (service, date, current price, tier progress such as
"3 more neighbours for 15% off"); camp detail with Join; My bookings (status, time, price, photos).

**Vendor:** log in; today's jobs in time order; job detail with Start (take photo) and Complete (take photo).

**Ops:** log in; camp table; create-camp form (society, service, date and window, slot length,
min and max, deadline, base price, tiers); camp detail with assign vendor, participant list,
Confirm and Cancel.

### 3.11 Key design decisions and trade-offs

| Decision | Alternative | What the choice costs |
| --- | --- | --- |
| Relational Postgres | MongoDB | None for this data; camps, bookings and prices are linked records with constraints. |
| Lock the camp row when joining | Count then insert with no lock; optimistic retry | Joins to one camp run one at a time. Fine at this scale. |
| One price for everyone, locked at confirmation | Early joiners keep their early price | Simpler and fairer; early joiners do not get a reward for joining first. |
| Ops confirms manually | Automatic at the deadline | Needs ops action; avoids building a scheduler. Add lazy deadline checks later. |
| Computed slots at confirmation | Slots table | Cannot swap slots easily. Far less to build. |
| Own JWT auth | Supabase Auth | You write the auth yourself; a single auth system to reason about. |
| Photos in object storage | Photos in the database | Needs a storage setup; keeps the database small and fast. |

---

## Part 4: Risks and Open Questions

| # | Risk or question | Handling |
| --- | --- | --- |
| R1 | Provisional price can rise before confirmation if neighbours leave. | Label it "current price", not "your price", and say so in the UI. Open question: guarantee a price floor? |
| R2 | The idea depends on enough neighbours joining (cold start). | Demo uses seeded data. Say clearly in the README that participation is simulated. |
| R3 | No phone verification in the MVP weakens the trust story. | Document it; add OTP right after the core slice. |
| R4 | One vendor per camp caps camp size. | Accept for the MVP; list as a known limit. |
| R5 | Discount percentages are invented. | Label them illustrative in the demo. |
| R6 | Free-tier hosting may sleep or pause and make a demo look broken. | Check current limits before relying on it; load the app before any demo. |
| R7 | Time zones. | Store timestamps in UTC; interpret and display in IST. |
| Q1 | What happens if a vendor cancels after confirmation? | Decide after the MVP; ops can reassign by hand. |
| Q2 | Should residents see the other residents who joined? | Default: counts only, no names, for privacy. |

---

## Part 5: Build Order

1. Scope and demo script (this document). Repo, Supabase project, `.env` handling.
2. Data model and first migration.
3. Auth and roles.
4. Camp lifecycle: pricing function first (with tests), then create, join, leave, confirm, cancel. Tests for overbooking.
5. Vendor job flow with photos.
6. Frontend: resident, then vendor, then ops.
7. Seed data, deploy, README.

After the MVP: OTP, vendor self-signup with approval, notifications, RWA dashboard, automatic deadline
handling, slot swapping, PWA install, rate