# Domora: Product Requirements Document (PRD)

| Field | Value |
| --- | --- |
| Version | 1.0 (MVP) |
| Date | 15 Nov 2026 |
| Owner | Sakalesh |
| Status | Approved for MVP build |
| Related | ARCHITECTURE.md, Problem Statement and MVP Design v1.0, Project Execution Blueprint v1.0 |

Conventions: MUST = required for the MVP. SHOULD = wanted, may slip. Items marked PENDING are open
decisions, not requirements. Anything described as "proposed" has not been confirmed by the owner.

---

## 1. Overview

Domora is a web app where residents of the same apartment building or gated community book the same
home service together, on the same day, and receive a group discount that grows with participation.
One vendor visits many homes in one building in a single day, which cuts travel time for the vendor
and cost for residents.

Domora is a portfolio project. It is not a launched business. No real payments, SMS or customers exist.

## 2. Problem statement

Households in the same building pay full price and arrange visits separately for the same home
services, while vendors lose hours travelling between scattered homes. Domora lets a society book a
service together on one day, with a group discount that grows with participation, so residents pay less
and vendors do more jobs per day.

| Who | Pain today |
| --- | --- |
| Residents | Full price per household, slots that suit the provider, time off to be at home. |
| Vendors | Large share of the day spent travelling between far-apart homes; fewer jobs and lower earnings per hour. |
| Society | Neighbours need the same service at the same time but have no way to coordinate. |

## 3. Goals and non-goals

Goals
- G1: Demonstrate the complete idea as a working, deployed product.
- G2: Demonstrate sound engineering: correct pricing, safe concurrent booking, role-based access, honest documentation of what is simulated.

Non-goals
- NG1: Real payments. NG2: Real SMS or phone verification. NG3: Market validation. NG4: Multiple cities or languages. NG5: Native mobile apps.

## 4. Users

| Role | Description | Main needs |
| --- | --- | --- |
| Resident | Lives in a society. Self-registers with the society invite code. | See what camps are open, see how the price changes as neighbours join, join and leave easily, see proof the work was done. |
| Vendor | Service provider. Account is created by the developer or ops (seed script in the MVP). | See jobs in time order with the address, record before and after photos. |
| Ops | Domora support. Account is seeded; can never be self-registered. | Create and run camps, assign vendors, confirm or cancel camps. |

Deferred role: RWA (society committee), read-only aggregate dashboard, post-MVP.

## 5. Scope

In scope (MVP): resident, vendor and ops flows listed in section 7.

Deferred (not removed):

| Item | Note |
| --- | --- |
| Phone OTP verification | Phone is collected but UNVERIFIED in the MVP. |
| Vendor self-signup and ops approval | MVP vendors are created by seed script. |
| RWA dashboard | Aggregates only, no personal data, when added. |
| Notifications, audit log | Not needed by the core flow. |
| Draft camp state, automatic confirm/cancel at deadline | MVP: ops creates a camp as open and confirms manually. |
| Slots table and slot swapping | MVP computes slot times at confirmation. |
| No-show handling, vendor-to-service validation | Known gaps. |
| PWA install and offline | Polish. |

Services at launch: Pest control and AC servicing (data rows, not code; adding one means adding a row).

## 6. Core concepts

| Term | Meaning |
| --- | --- |
| Society | A building or gated community, identified to residents by an invite code. |
| Camp | One service, one day, one society, one vendor; has a time window, slot length, minimum and maximum participants, join deadline, base price and price tiers. |
| Price tier | "At N or more homes the discount is P percent." |
| Booking | One resident's participation in one camp. |
| Slot | The fixed-length visit time given to a booking at confirmation. |
| Job record | The vendor's proof of work for one booking: before and after photos. |
| Provisional price | The price shown while a camp is open; follows the current headcount; can change. |
| Final price | Computed once at confirmation; identical for all participants; never changes after. |

## 7. Functional requirements

### 7.1 Accounts and access

| ID | Requirement | Priority | Phase |
| --- | --- | --- | --- |
| FR-A1 | A resident can sign up with username, password, full name, phone, unit label and a valid society invite code. | MUST | 2 |
| FR-A2 | A user can log in with username and password and receives an access token. | MUST | 2 |
| FR-A3 | A logged-in user can fetch their own profile (role, society). | MUST | 2 |
| FR-A4 | Ops and vendor accounts can only be created by the seed script. No public endpoint can create them. | MUST | 2 |
| FR-A5 | Every protected endpoint enforces role and ownership on the server. | MUST | 2 |
| FR-A6 | Phone number is collected but not verified (documented limitation). | MUST | 2 |

### 7.2 Resident

| ID | Requirement | Priority | Phase |
| --- | --- | --- | --- |
| FR-R1 | List camps of the resident's own society, filterable by status. Other societies' camps are never visible. | MUST | 4 |
| FR-R2 | Camp detail shows: service, date, window, join deadline, base price, tiers, participants, spots left, current price and discount, next tier and neighbours needed, and the resident's own booking if any. | MUST | 4 |
| FR-R3 | Join an open camp before its deadline, subject to capacity and the one-active-booking rule. | MUST | 4 |
| FR-R4 | Leave a camp up to 24 hours before the window starts. | MUST | 4 |
| FR-R5 | List and view own bookings: status, slot time, quoted and final price, before and after photos. | MUST | 4, 5 |
| FR-R6 | Price label is "current price" while the camp is open and "your price" only once locked. | MUST | 6 |

### 7.3 Vendor

| ID | Requirement | Priority | Phase |
| --- | --- | --- | --- |
| FR-V1 | See jobs for camps assigned to them, in time order, with resident name, unit and society address. Resident phone visibility is PENDING (proposed: shown for that vendor's own jobs only). | MUST | 5 |
| FR-V2 | Start a job by uploading a before photo. | MUST | 5 |
| FR-V3 | Complete a job by uploading an after photo; a before photo must already exist. | MUST | 5 |
| FR-V4 | A vendor can never see or act on another vendor's jobs. | MUST | 5 |

### 7.4 Ops

| ID | Requirement | Priority | Phase |
| --- | --- | --- | --- |
| FR-O1 | Create a camp with society, service, date, window, slot length, minimum and maximum participants, join deadline, base price and tiers. The camp starts as open. | MUST | 4 |
| FR-O2 | Assign or change the vendor of an open or confirmed camp. | MUST | 4 |
| FR-O3 | List camps and view a camp with its participants. | MUST | 4 |
| FR-O4 | Confirm a camp (rules in 8.3). | MUST | 4 |
| FR-O5 | Cancel an open or confirmed camp with a required reason; all active bookings are cancelled. | MUST | 4 |
| FR-O6 | Read-only reference lists (societies, services, vendors) so the create-camp and assign-vendor forms can work. | MUST | 4, 6 |
| FR-O7 | Camp fields other than the vendor are not editable after creation; to fix a mistake, cancel and recreate. PROPOSED, needs owner confirmation. | SHOULD | 4 |

### 7.5 System behaviour

| ID | Requirement | Priority | Phase |
| --- | --- | --- | --- |
| FR-S1 | Joining closes at the join deadline. | MUST | 4 |
| FR-S2 | At confirmation the final price is computed once and slots are assigned (section 8). | MUST | 4 |
| FR-S3 | The first started job moves the camp to in progress; when every non-cancelled booking is completed the camp becomes completed. | MUST | 4, 5 |
| FR-S4 | If every participant of a confirmed camp cancels, the camp becomes cancelled. | MUST | 4 |
| FR-S5 | All timestamps are stored in UTC and displayed in IST. | MUST | 1, 6 |

## 8. Business rules

### 8.1 Camp creation validation
- Window end is after window start; at least one whole slot fits in the window.
- Maximum participants is at least the minimum and no more than the number of whole slots.
- Minimum participants is at least 1.
- Join deadline is in the future and at least 24 hours before the window starts.
- Base price is zero or more. Money is integer paise, never floats.
- Tiers: at least one; headcounts strictly increase; discounts never decrease; each discount is 0 to 100.

### 8.2 Pricing
- Discount = the highest tier whose headcount has been reached; 0% below the lowest tier.
- Price = base price after discount, integer paise, rounded half up.
- While open: provisional price follows the current headcount.
- At confirmation: final price is computed once from the headcount and applied to everyone.
- After confirmation: the price is locked; later cancellations never re-price other residents.
- Worked example (illustrative numbers): base Rs 800; 3 homes = 10% (Rs 720); 6 homes = 15% (Rs 680); 10 homes = 20% (Rs 640).

### 8.3 Confirmation
- Allowed only on an open camp with participants at or above the minimum and a vendor assigned.
- Participants are ordered by join order and given consecutive slots starting at the window start; each visit lasts the slot length.
- Bookings move to scheduled; the camp moves to confirmed.
- A cancellation after confirmation frees that resident's slot but does not shift others and is not re-offered.

### 8.4 Joining and leaving
1. A resident has at most one non-cancelled booking per camp; re-joining after cancelling is allowed.
2. Non-cancelled bookings never exceed the camp's maximum, even under simultaneous requests.
3. Residents can only see and join camps of their own society.
4. Only open camps before their deadline can be joined.
5. Residents can leave up to 24 hours before the window starts; ops can cancel any time.
6. A resident may join several camps on the same day; overlapping slots are possible and accepted for the MVP.

### 8.5 Jobs
- A job can start only when its booking is scheduled and the camp is confirmed or in progress.
- A job cannot be completed without a before photo.
- Only the camp's assigned vendor can act on its jobs.

## 9. Acceptance criteria (key scenarios)

| ID | Scenario |
| --- | --- |
| AC-1 | Given an open camp (base Rs 800, 3 homes = 10%), when three different residents join, then the camp shows participants 3, current price Rs 720, and neighbours needed for the next tier. |
| AC-2 | Given a camp with one spot left, when two residents join at the same instant, then exactly one succeeds and the other is refused as full. |
| AC-3 | Given a resident already in a camp, when they join again, then it is refused; after leaving, joining succeeds. |
| AC-4 | Given a resident of society A, when they request a camp of society B, then it is reported as not found. |
| AC-5 | Given an open camp with fewer participants than the minimum, when ops confirms, then it is refused with a clear reason. |
| AC-6 | Given an open camp with enough participants but no vendor, when ops confirms, then it is refused. |
| AC-7 | Given a confirmed camp with price Rs 720, when one resident cancels, then the others still pay Rs 720. |
| AC-8 | Given a booking whose window starts in 23 hours, when the resident tries to leave, then it is refused; when ops cancels it, then it succeeds. |
| AC-9 | Given a scheduled job, when the vendor tries to complete it without starting, then it is refused. |
| AC-10 | Given a job in progress, when the vendor uploads a non-image file, then it is refused. |
| AC-11 | Given a resident, when they call an ops endpoint, then they receive 403; with no token, 401. |
| AC-12 | Given the signup endpoint, when someone requests the ops role, then it is rejected; no endpoint creates ops. |
| AC-13 | The full demo script (section 11) runs in a browser at phone width without calling the API by hand. |

## 10. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Security | Passwords stored with a vetted slow hash; tokens signed and expiring; role and ownership checked in one central place; secrets only in environment variables; photos in a private bucket served by short-lived links; upload type checked from content and size limited; database tables not exposed through Supabase's own API (RLS enabled with no policies, to be VERIFIED). |
| Correctness | Money in integer paise; booking operations are transactional and safe under concurrency; invalid states are rejected by database constraints as well as code. |
| Usability | Mobile-first; core flows usable at phone width; every API failure shown to the user in plain words; no price shown as final until locked. |
| Privacy | Residents see participant counts only, not names (PENDING P6, default); vendors see only the residents of their own jobs; no real payment data exists; MVP collects only name, phone, unit. |
| Reliability | Best effort. Free-tier cold starts or pauses are acceptable but must be documented and the app woken before demos. |
| Performance | No formal targets. Pages should feel responsive on seeded data. |
| Maintainability | Versioned migrations; automated tests for pricing, rules, concurrency and authorization; README kept current. |
| Accessibility | SHOULD: labelled form fields, readable contrast, keyboard operable. |
| Observability | Basic request and error logging; a health endpoint. |
| Legal | Not assessed. If ever launched with real users, a privacy and legal review is required. |

## 11. Demo script (MVP acceptance story)

Setup: society "Sunrise Heights", service Pest control, base Rs 800, window 10:00 to 16:00, 30-minute
visits, minimum 3, tiers 3 = 10%, 6 = 15%, 10 = 20% (illustrative).

1. Ops logs in, creates the camp and assigns a vendor.
2. Resident A signs up with the invite code, opens the camp, sees "Rs 800 now, 3 neighbours needed for 10% off", and joins.
3. Residents B and C join; the screen shows 3 joined, Rs 720, and how many more neighbours unlock 15%.
4. Ops confirms. Each booking gets the locked price Rs 720 and a time: 10:00, 10:30, 11:00.
5. The vendor logs in, sees three jobs in order, starts the first with a before photo, completes it with an after photo.
6. Resident A opens My bookings and sees the completed booking with both photos.

## 12. Success criteria

1. The demo script runs end to end in a browser in under 5 minutes.
2. Pricing and overbooking are covered by automated tests, including two simultaneous joins for the last spot.
3. The app is deployed at a public URL with seeded demo data.
4. The README states plainly what is simulated.

## 13. Assumptions and validation status

| # | Assumption | Status |
| --- | --- | --- |
| A1 | Enough neighbours want the same service in the same window to reach a minimum. | Unvalidated |
| A2 | Vendors accept a lower per-home price in return for volume and less travel. | Unvalidated |
| A3 | Residents trust a platform and a vendor they did not choose. | Unvalidated |
| A4 | The tier percentages are viable for vendors. | Illustrative only |

Suggested low-cost validation: short conversations with about 5 residents and 2 local vendors, written up.

## 14. Risks

| # | Risk | Handling |
| --- | --- | --- |
| R1 | The provisional price can rise before confirmation if neighbours leave. | PENDING decision P1: label-only warning or a guaranteed price floor. Decide before building camp views. |
| R2 | Cold start: too few neighbours join. | Demo uses seeded data; say so. |
| R3 | No phone verification weakens trust. | Document; OTP first after the MVP. |
| R4 | One vendor per camp caps camp size (roughly 12 to 18 homes). | Accept; list as a limit. |
| R5 | Tier percentages are invented. | Label as illustrative. |
| R6 | Free-tier hosting sleeps or pauses. | Check limits; wake before demos. |
| R7 | Time zone mistakes. | UTC storage, IST display, tests around midnight. |

## 15. Open decisions

| # | Question | Decide by |
| --- | --- | --- |
| P1 | Price floor or warning label for provisional price (R1). | Before camp views |
| P2 | How tests get a real Postgres. | Phase 0 |
| P3 | Photo size limit, allowed formats, bucket setup. | Phase 5 |
| P4 | Hosting choice. | Phase 7 |
| P5 | Where the frontend stores the token. | Phase 6 |
| P6 | Do residents see other participants' names? (default: counts only). | Phase 4 |
| P7 | Repository public or private, and when. | Phase 0 |
| P8 | Vendor sees resident phone numbers for own jobs? (proposed: yes, own jobs only). | Phase 5 |
| P9 | Confirm FR-O7: camps immutable after creation except vendor. | Phase 4 |

## 16. After the MVP

OTP verification; vendor self-signup with ops approval; automatic deadline handling; notifications; RWA
dashboard; slots table and swapping; rate limiting; PWA install; audit log.

## 17. Document control

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 15 Nov 2026 | First MVP PRD. |