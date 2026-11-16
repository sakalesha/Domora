# Domora: Project Execution Blueprint (Development Roadmap)

Version 1.0, 15 Nov 2026. Owner: Sakalesh. Companion to: "Domora: Problem Statement and MVP Design v1.0".

---

## 1. Purpose and how to use this document

This is the plan for building the Domora MVP: what to do, in what order, how to know a phase is
finished, and what you must be able to explain afterwards. It does not contain code. You write the
code; coding agent guides, questions and reviews.

How to use it:
1. Work on ONE phase at a time. Do not start the next until the exit gate of the current one is met.
2. At the end of each phase, run the review checkpoint (section 6) before moving on.
3. New ideas go into the backlog (section 12), never into the current phase.
4. Update the progress tracker (section 11) and decision log (section 10) as you go.

---

## 2. Project snapshot

| Item | Value |
| --- | --- |
| Goal | A working, deployed MVP that demonstrates group booking of home services with tiered discounts. |
| Type | Portfolio project, not a launched business. No real payments, SMS or customers. |
| Users in MVP | Resident, Vendor, Ops. |
| Stack | React + Vite, FastAPI, Supabase Postgres + Storage, own JWT auth, Alembic migrations. |
| Core promise | Neighbours join a camp; the price drops as headcount grows; the price locks at confirmation; the vendor proves the work with before/after photos. |
| Deadline | None. Self-imposed milestones recommended (section 9). |
| MVP success criteria | (1) Demo script runs in a browser in under 5 minutes. (2) Pricing and overbooking covered by automated tests. (3) Public URL with seeded data. (4) README states plainly what is simulated. |

Demo numbers to keep in mind (illustrative): base Rs 800; tiers 3 homes = 10% (Rs 720),
6 homes = 15% (Rs 680), 10 homes = 20% (Rs 640); window 10:00 to 16:00, 30-minute visits.

---

## 3. Working agreement

| Topic | Rule |
| --- | --- |
| Who writes code | You and coding agent. |
| Coding agent role | Ask questions, challenge assumptions, flag gaps with a confidence level, point to concepts and docs, review what you bring. |
| The generated zip | Stays closed. Optional: open it after finishing a phase, only to compare approaches. Never copy from it. |
| Review protocol | Bring the five items in section 6. coding agent responds with questions and findings, not rewrites. |
| Honesty standard | Facts, evidence, inferences and opinions are labelled. Uncertainty is stated. Unverified claims are marked unverified. |
| Timeboxing | If a task takes 2x its estimate, stop and ask: wrong approach, or scope too big? |
| Project log | Keep a short daily log (3 lines: did, blocked on, next). Useful for the retrospective and for interviews. |

---

## 4. Phase overview

Unit: one "focused day" is about 5 to 6 hours of productive work, not a calendar day.

| Phase | Outcome | Focused days | Depends on | Exit gate (short) |
| --- | --- | --- | --- | --- |
| 0 Foundations | Repo, environment, database reachable | 1 to 1.5 | none | Fresh clone connects to the database. |
| 1 Data model | Schema, constraints, migrations, RLS | 2 to 3 | 0 | Database itself rejects invalid data. |
| 2 Auth and roles | Signup, login, role guard | 2 to 3 | 1 | Role and 401/403 behaviour tested. |
| 3 Pricing and camp rules | Pure, tested pricing and validation logic | 2 | 1 | Demo numbers match by hand and in tests. |
| 4 Camp lifecycle and bookings | Create, join, leave, confirm, cancel, safe under concurrency | 4 to 5 | 2, 3 | Overbooking test passes. |
| 5 Vendor flow and photos | Start/complete with photos | 2 to 3 | 4 | Cannot complete without a before photo. |
| 6 Frontend | Resident, vendor, ops screens | 6 to 8 | 4, 5 | Demo script runs in the browser. |
| 7 Seed, deploy, document | Live demo and README | 3 to 4 | 6 | All 4 success criteria met. |

---

## 5. Phase details

### Phase 0: Foundations (1 to 1.5 focused days)

**Objective:** a clean starting point where any machine can run the project.

Tasks:
- [X] Create the git repository.
- [X] Create folders: `backend/`, `frontend/`, `docs/`. Put the problem statement, MVP design, this blueprint, a decision log and the project log in `docs/`.
- [X] Add `.gitignore` and an `.env.example` listing every setting with no real values. Confirm the real `.env` is ignored.
- [X] Set up the Python virtual environment and pin dependency versions.
- [X] Select a Supabase connection approach: direct requires IPv6; use the session pooler where the host is IPv4-only. The current machine has no IPv6 route, so its direct endpoint is not reachable.
- [X] Add a small database connection check (`backend/scripts/check_db.py`); connection verified against Supabase Postgres.
- [X] Decide how tests will get a REAL Postgres: use the Supabase development project for PostgreSQL-specific, transaction-rolled-back checks; keep production separate. Fast local schema tests remain on SQLite.

Deliverables: repo with README, working DB connection, decision log started.
Concepts to understand: environment variables and secret handling; what a connection pooler does.
Exit gate: following only your README, a fresh clone connects to the database.
Common traps: committing secrets; using the wrong connection type for migrations.
Explain-back: Why are secrets kept out of git? What breaks if two environments share one database?

### Phase 1: Data model (2 to 3 focused days)

**Objective:** a schema that makes invalid states hard or impossible.

Tasks:
- [X] Record the ERD from MVP design section 3.8 in `docs/data-model-erd.md`. It is a digital ERD added after implementation rather than the original before-code paper exercise.
- [X] Create the 7 tables: societies, users, services, camps, camp_price_tiers, bookings, job_records.
- [X] Encode the specified database rules: camp CHECK constraints; the partial unique index; "after photo requires before photo"; society and unit required for residents.
- [X] Set up migrations. Run "up", "down", "up" again to prove they are reversible. Verified on a disposable SQLite database; PostgreSQL SQL generation also checked offline.
- [X] Enable Row Level Security with no policies on every table in the PostgreSQL migration.
- [X] Verify RLS against Supabase: read through the auto-generated API using the public key and confirm no rows are exposed. RLS catalog, anon-role, and public API checks pass.
- [X] Write a minimal idempotent seed for services and one society. Ran twice against a disposable SQLite database.

Decisions: statuses use text with CHECK constraints; identifiers use native PostgreSQL UUIDs; timestamps are timezone-aware and stored in UTC.
Tests (behaviour, written as "the database refuses..."): duplicate active booking; camp whose end is before its start; deadline after start; negative price; after-photo-without-before-photo; resident without a society.
Concepts to understand: constraints vs application validation; partial indexes; why money is stored as integer paise; why store UTC.
Exit gate: every rule above is rejected by the database in a test, and migrations round-trip.
**Current status:** Phase 1 exit gate passed against Supabase Postgres. Local schema tests and SQLite migration round-trip also pass. The paper-before-code exercise was replaced by the recorded digital ERD.
Common traps: relying on `now()` for ordering (it is the transaction start time, so rows created in one transaction tie; use a real insertion time or an explicit sequence for join order); forgetting RLS on a new table later.
Explain-back: Why a partial unique index instead of a plain one? Why integer paise? What does RLS with no policies do?

### Phase 2: Authentication and roles (2 to 3 focused days)

**Objective:** users can sign up and log in, and every endpoint knows who is calling and what they may do.

Tasks:
- [x] Choose a vetted password-hashing library; never invent your own. Understand salting and cost.
- [x] Resident signup requires a valid society invite code. Login returns a token. `/auth/me` returns the caller.
- [x] Create ONE reusable role-check dependency for role-restricted routes; `/auth/me` uses the shared current-user dependency, and future role-scoped routes must reuse this check.
- [x] Ops and vendor accounts exist only via the seed script. No signup path can create ops.
- [x] Decide the error policy: 401 (not logged in or bad credentials), 403 (wrong role), 404 for other societies' resources so you do not leak their existence.
- [x] Token lifetime is one day; current account and role are re-read from the database on each protected request.

Tests: all auth cases above pass in `backend/tests` (42 passed, 0 failed), including generic invalid-credential responses, missing/invalid/expired tokens, role rejection, database role/active-state freshness, signup role escalation, wrong invite, and duplicate username/phone.
Concepts to understand: JWT structure and why it is signed, not encrypted; stateless vs session auth; authentication vs authorization.
Exit gate: implementation and test checks pass. Owner explain-back/review of the protected-request flow is still pending.
Common traps: plaintext or fast-hash passwords; very long token lifetimes; trusting the client about the role.
Explain-back: What does a JWT contain and who can read it? Why must authorization live on the backend even if the frontend hides buttons?

### Phase 3: Pricing and camp rules (2 focused days)

**Objective:** the money and capacity logic, written as pure functions with tests, before any API touches it.

Tasks:
- [ ] Write down the pricing rules in plain language first (MVP design 3.4).
- [ ] Write the test cases BEFORE the logic: headcount below the lowest tier, exactly at a tier, between tiers, above the top tier, rounding edge cases, invalid tier lists (duplicates, decreasing discounts, out-of-range percentages).
- [ ] Implement: discount for a headcount; price after discount in integer paise (round half up); "next tier" information (how many more neighbours for what percentage).
- [ ] Implement camp-parameter validation: number of whole slots in the window; maximum participants cannot exceed slots; join deadline at least 24 hours before the window starts; minimum at least 1 and at most the maximum.

Deliverables: a small pricing module and a validation module with their tests; a hand-calculated table of demo numbers.
Exit gate: 3 homes gives Rs 720, 6 gives Rs 680, 10 gives Rs 640 from base Rs 800, both by hand and in tests.
Common trap: using floating point for money.
Explain-back: Why integer paise and a fixed rounding rule? Why write tests before the function?

### Phase 4: Camp lifecycle and bookings (4 to 5 focused days)

**Objective:** the heart of the product: camps and bookings that stay correct under concurrent use.

Sub-phases:
- **4a Ops camp management:** create a camp with tiers, assign a vendor, list and view camps with participants.
- **4b Resident camp views:** only the resident's own society; computed fields: participants, spots left, provisional current price, next tier and neighbours needed.
- **4c Join and leave:** rules 1, 2, 3 and 9 from the design (one active booking, capacity, society isolation, deadline); leave is allowed up to 24 hours before the window; ops may cancel any time.
- **4d Confirm and cancel camp:** confirm needs enough participants and a vendor; it computes the final price once, applies it to everyone, assigns consecutive time slots in join order, and moves bookings to "scheduled"; cancel needs a reason and cancels all active bookings.
- **4e Derived transitions:** when every participant cancels a confirmed camp, the camp is cancelled; when every booking is completed, the camp is completed.

DECISION GATE before 4b: risk R1 (provisional price can rise if neighbours leave before confirmation). Choose: label-only warning, or a guaranteed price floor. Record it in the decision log.

Concurrency, learn it by failing first:
1. Implement join the naive way (count, then insert, no protection).
2. Write the test: many residents try to take the last spot at the same moment; also one resident double-submitting.
3. Watch it fail. Then fix it. Then explain why the fix works and what the alternatives are (row lock, retry on conflict).

Tests to include: all nine business rules in MVP design 3.6; cancel cutoff at exactly 24 hours; price stays locked after a post-confirmation cancellation; slot order equals join order; confirm below minimum and confirm without a vendor are refused; other-society camp is invisible; re-joining after cancelling works.
Concepts to understand: transactions; isolation; row locking; idempotency; state machines and invalid transitions.
Common traps: join-order ties from `now()`; changing several rows without one transaction; trusting a price sent by the client; two ops confirming the same camp at once.
Exit gate: the concurrency tests pass reliably (run them many times), and you can explain every transition in the camp and booking state diagrams without notes.
Explain-back: What exactly goes wrong without the lock? What happens if two ops press Confirm simultaneously? Why is the final price computed on the server only?

### Phase 5: Vendor flow and photos (2 to 3 focused days)

**Objective:** proof of work.

Tasks:
- [ ] Decide the storage approach (decision P3). Recommended direction: a PRIVATE bucket, the database stores only the file path, viewing uses short-lived signed links. Check current Supabase Storage docs and test it once; it was never verified in earlier advice.
- [ ] Vendor job list in time order, restricted to the vendor's own camps.
- [ ] Start a job: requires a before photo; completes the booking transition; moves the camp to "in progress" if it is the first.
- [ ] Complete a job: requires an after photo and an existing before photo.
- [ ] Validate uploads: identify the image type from its content, not the client's header; enforce a size limit.
- [ ] Residents can see their own booking's photos.

Tests: cannot complete before starting; double start and double complete refused; another vendor gets "not found"; a non-image file is refused; an oversized file is refused; the camp becomes completed when all bookings finish.
Concepts to understand: object storage vs database blobs; signed URLs; why a service-level key must never reach the browser.
Common traps: public bucket; trusting file extensions; exposing the storage key in the frontend.
Exit gate: the "cannot complete without a before photo" rule holds in both code and database.
Explain-back: What is a signed URL and why use one? Why not store photos in the database?

### Phase 6: Frontend (6 to 8 focused days)

**Objective:** the demo script runs end to end in the browser, designed for phones first.

Sub-phases:
- **6a Foundation (1 to 1.5 days):** project setup, routing, an API client layer, auth state, role-based route guards, consistent loading and error states. Decide where the token is stored and know the trade-offs (decision P5).
- **6b Resident (2 to 2.5 days):** signup with invite code, login, camp list with tier progress ("3 more neighbours for 15% off"), camp detail with Join and Leave, My bookings with status, time, price and photos. Label the price "current price" while the camp is open and "your price" only once locked.
- **6c Vendor (1.5 to 2 days):** jobs in time order, start and complete with camera upload on a phone-sized screen.
- **6d Ops (1.5 to 2 days):** camp table, create-camp form with tiers, camp detail with assign vendor, participants, Confirm and Cancel.

Rules: plain and functional first; no styling rabbit holes (timebox styling to a fixed slice of each sub-phase); handle every API error status visibly; keep ops screens minimal.
Common traps: treating frontend route guards as security; CORS errors late in the project; forgetting token expiry handling; building ops UI too fancy.
Exit gate: the full demo script (MVP design 2.3) runs in a browser at phone width without touching the API directly.
Explain-back: Where is authorization actually enforced? How does the UI behave when the API returns 401, 403, 409?

### Phase 7: Seed, deploy, document (3 to 4 focused days)

**Objective:** something a stranger can open and understand.

Tasks:
- [ ] Seed realistic demo data (two societies, a few camps in different states, several residents). Prefer a seed that goes through the same rules as the app rather than raw inserts that bypass them; if you choose raw inserts, say why.
- [ ] Dry-run the full demo script from a clean database. Fix every rough edge.
- [ ] Choose hosting for backend and frontend (decision P4). Check CURRENT free-tier limits and sleep/pause behaviour first.
- [ ] Configure production environment variables; refuse to start with default secrets; run migrations on the production database; set CORS correctly; add a health check.
- [ ] Write the README: problem, who it helps, architecture diagram, how to run locally, the demo script, what is simulated, known limitations, key design decisions with trade-offs.
- [ ] Record a short demo video or GIF.
- [ ] Retrospective: what was harder than expected, what you would change, what you learned.

Exit gate: all four MVP success criteria are met.
Common traps: a demo that fails because the free-tier database or server was asleep; undocumented mocked features; leaving the seed credentials usable in "production".

---

## 6. Review checkpoint (end of every phase)

1. What you built, in 2 to 3 sentences.
2. The code, design or diff you want reviewed (not the whole repo).
3. Test results, including anything that failed along the way.
4. What you are unsure about or where you cut corners.
5. Your written answers to that phase's explain-back questions.

Human will question your reasoning, flag gaps with a confidence level, and point to concepts to study.
Human will not rewrite your code.

A phase is "reviewed" only when you can answer the explain-back questions without looking at your code.

---

## 7. Testing strategy

| Level | What it covers | Where |
| --- | --- | --- |
| Pure unit tests | Pricing, tier validation, slot math | Phase 3 |
| Database tests | Constraints reject invalid data | Phase 1 |
| Integration tests | Auth, camp lifecycle, bookings, jobs through the API | Phases 2 to 5 |
| Concurrency tests | Last-spot race, double submit | Phase 4 |
| Manual end-to-end | The demo script, on a phone-sized screen | Phases 6 and 7 |

Rules: tests run against a REAL Postgres (locks, partial indexes and concurrency behave differently on
substitutes); tests clean up after themselves; run concurrency tests repeatedly to expose flakiness; a
phase is not done with failing tests.

Definition of Done for any task: behaviour works; a test proves it; edge cases considered; error responses
are sensible; the decision log and README notes are updated.

---

## 8. Git workflow

- One branch per phase; merge when its exit gate and review are done.
- Small commits with clear messages (what and why).
- Tag each finished phase (for example `phase-1-data-model`).
- Never commit secrets. If one leaks, rotate it; deleting the commit is not enough.
- Keep the README updated as you go, not at the end.

---

## 9. Timeline

Total estimate: about 22 to 30 focused days. With a 25% buffer: about 28 to 38 focused days.

| Pace | Duration |
| --- | --- |
| 5 focused days per week | roughly 6 to 8 weeks |
| 3 focused days per week | roughly 9 to 13 weeks |

Confidence: LOW to MEDIUM. Phases 4 and 6 are the most uncertain; frontend work is the most commonly
underestimated. This estimate is deliberately more conservative than the earlier "3 to 4 weeks" figure,
because the tasks are now itemised. Use this one.

Self-imposed milestones (fill in dates):

| Milestone | Target date |
| --- | --- |
| Phase 1 done (schema + RLS verified) | |
| Phase 4 done (core logic safe under concurrency) | |
| Phase 5 done (backend feature complete) | |
| Phase 6 done (demo runs in browser) | |
| Phase 7 done (live and documented) | |

If you miss a milestone by more than 30%, hold a scope review (section 12) instead of silently slipping.

---

## 10. Decision log

Decided:

| # | Decision |
| --- | --- |
| D1 | Fresh build; stack is FastAPI + Supabase Postgres + React + Vite PWA. |
| D2 | Only ops creates camps; one vendor per camp; tiered discount; one price for everyone, locked at confirmation. |
| D3 | Residents may cancel up to 24h before the window; may join several camps on the same day. |
| D4 | Residents sign up with a society invite code; ops accounts are never self-registered. |
| D5 | MVP defers OTP, vendor self-signup/approval, RWA dashboard, notifications, audit log, slots table, PWA install. |
| D6 | Own JWT authentication, not Supabase Auth. |
| D7 | Camps are created open; ops confirms manually; no deadline automation in the MVP. |
| D8 | Use the Supabase development project for PostgreSQL-specific, transaction-rolled-back schema checks; production must use a separate project. |

Pending (decide at the phase shown):

| # | Question | Decide by |
| --- | --- | --- |
| P1 | R1: guaranteed price floor, or label-only warning that the open-camp price can rise? | Before Phase 4b |
| P3 | Photo storage details: bucket setup, size limit, allowed formats. | Phase 5 |
| P4 | Hosting for backend and frontend (verify current free-tier limits first). | Phase 7 |
| P5 | Token storage in the browser and the trade-offs you accept. | Phase 6a |
| P6 | Do residents see other participants' names, or only counts? (Default: counts only.) | Phase 4b |
| P7 | Public or private repository, and when it goes public. | Phase 0 |

---

## 11. Progress tracker

| Phase | Status | Started | Finished | Review done | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 Foundations | Complete | 2026-11-15 | 2026-11-15 | No | Database connection verified; README, env template, and test-database decision recorded. |
| 1 Data model | Complete | 2026-11-15 | 2026-11-15 | No | Postgres migration round-trip, constraints, RLS, and public API verified; digital ERD used instead of paper exercise. |
| 2 Auth and roles | Complete | 2026-11-16 | 2026-11-16 | No | Steps 1-4 and T001-T019 implemented; 42 tests passed and the Supabase development migration round-trip passed. Owner explain-back/review remains pending; phone unverified and no refresh/revocation flow in MVP. |
| 3 Pricing and camp rules | Not started | | | | |
| 4 Camp lifecycle and bookings | Not started | | | | |
| 5 Vendor flow and photos | Not started | | | | |
| 6 Frontend | Not started | | | | |
| 7 Seed, deploy, document | Not started | | | | |

---

## 12. Risks, scope control and backlog

### Risk register

| # | Risk | Early warning sign | Mitigation |
| --- | --- | --- | --- |
| K1 | Scope creep | You start a "quick" extra feature mid-phase | Add it to the backlog; finish the phase first. |
| K2 | Concurrency bugs ship unnoticed | Tests pass only sometimes | Run concurrency tests many times; understand the lock, do not just copy a pattern. |
| K3 | Time zone mistakes | Slots appear at the wrong hour | Store UTC, interpret and display in IST, test across midnight and DST-free IST. |
| K4 | Supabase specifics differ from assumptions | Connection errors, RLS or storage surprises | Verify each in Phase 0, 1 and 5 against current docs; log findings. |
| K5 | Frontend overruns | Phase 6 passes 1.5x its estimate | Cut ops UI polish; keep screens plain. |
| K6 | Free-tier hosting sleeps or pauses | Demo is slow or fails after idle time | Check limits early; wake the app before any demo. |
| K7 | Motivation drop mid-project | Gaps of several days with no log entry | Keep phases small; tag each finished phase; see progress in the tracker. |
| K8 | You cannot explain your own code | Explain-back answers need the code open | Do not advance until you can answer without notes. |

### Scope control rule

If a milestone slips by more than 30%, cut in this order: polish, ops UI detail, tier-progress niceties,
seed richness. Never cut tests for pricing, concurrency or authorization.

### Backlog after the MVP (in suggested order)

1. Phone OTP verification (with a mock SMS provider, stated honestly).
2. Vendor self-signup with ops approval.
3. Automatic deadline handling (confirm or cancel when the join deadline passes).
4. Notifications.
5. RWA read-only dashboard (aggregates only, no personal data).
6. Slots table and slot swapping by ops.
7. Rate limiting on login and signup.
8. PWA install and offline basics.
9. Audit log.
10. Customer and vendor validation interviews (see problem statement 1.5), which can start any time and cost almost nothing.

---

## 13. Appendix: documents in this project

| Document | Status |
| --- | --- |
| Problem Statement and MVP Design v1.0 | Agreed |
| Project Execution Blueprint v1.0 (this document) | Agreed on adoption |
| Decision log (section 10, keep in `docs/`) | Living document |
| Project log (daily, in `docs/`) | Living document |
| README | Written during Phase 7, drafted from Phase 0 |