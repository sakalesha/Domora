# Phase 4c Implementation Plan: Resident Join and Leave Bookings

## 1. Overview & Objectives

Sub-phase 4c implements the transactional core of Domora: allowing verified residents (`role: "resident"`) to join and leave open group-buying service camps within their own society.

The central challenge in 4c is **correctness under concurrent use**:
- When multiple residents compete for the final spot in a camp at the exact same instant, the system must **never overbook** (`active_bookings <= max_participants`).
- A resident must never hold more than one active booking in a single camp (enforced both at the domain layer and via the PostgreSQL partial unique index).
- Re-joining after cancelling must work smoothly.
- Price quotes must be computed in integer paise via the Phase 3 pricing engine.
- Resident cancellations are strictly governed by the 24-hour lead-time rule.

---

## 2. Core Business Rules (Rules 1, 2, 3, 9 & Cancellation Cutoff)

1. **Rule 1: At Most One Active Booking per Resident per Camp**:
   - A resident may hold at most one booking in a camp with `status != 'cancelled'`.
   - If a resident already has an active booking (`joined` or `scheduled`) in the camp, a subsequent join attempt is rejected with `409 Conflict` (`"You already have an active booking in this camp"`).
   - If a resident previously cancelled their booking, they **are permitted to re-join**. A new booking row is created.
   - Enforced by application logic and guaranteed at the storage level by the database partial unique index:
     `uq_active_booking_per_camp_resident ON bookings (camp_id, resident_id) WHERE status != 'cancelled'`.

2. **Rule 2: Concurrency & Overbooking Protection**:
   - Total active bookings (`status != 'cancelled'`) must **never exceed `camp.max_participants`**.
   - To prevent race conditions (two requests reading count $N-1$ simultaneously and both inserting to reach $N+1$), the camp record is locked within the transaction using row-level locking:
     ```python
     camp = session.execute(
         select(Camp).where(Camp.id == camp_id).with_for_update()
     ).scalar_one_or_none()
     ```
   - If `active_bookings >= camp.max_participants`, join is rejected with `409 Conflict` (`"Camp is full"`).

3. **Rule 3: Strict Society Isolation**:
   - A resident can only view, join, or leave camps belonging to their own society (`resident.society_id == camp.society_id`).
   - If a resident attempts to access or join a camp from a different society, the backend responds with **`404 Not Found`** to cloak the camp's existence.

4. **Rule 9: Join Deadline Enforcement**:
   - A resident can only join while `now() < camp.join_deadline`.
   - If the join deadline has passed, join attempts are rejected with `422 Unprocessable Content` (`"Join deadline has passed for this camp"`).

5. **Camp State Restrictions**:
   - Joining is only permitted when `camp.status == "open"`.
   - Joining a camp that is `confirmed`, `in_progress`, `completed`, or `cancelled` is rejected with `422 Unprocessable Content`.

6. **Leave / Cancellation Cutoff Rule**:
   - A resident may leave (cancel) their active booking only if:
     `now() < camp.starts_at - 24 hours`
   - If fewer than 24 hours remain before the camp service window starts (`starts_at`), resident cancellation is blocked with `422 Unprocessable Content` (`"Bookings cannot be cancelled within 24 hours of the service window"`).
   - On valid cancellation, the booking is transitioned:
     - `status = "cancelled"`
     - `cancelled_at = now()` (timezone-aware UTC)

7. **Provisional Quoted Price on Join**:
   - When a resident joins, the new active headcount is $K = \text{existing\_active} + 1$.
   - The provisional quote is calculated using Phase 3 pure domain engine:
     `quote = calculate_pricing_quote(camp.base_price_paise, K, camp.price_tiers)`
   - The booking record stores `quoted_price_paise = quote.final_price_paise`.
   - Note: The actual price charged to all residents is finalized later at camp confirmation (Phase 4d).

---

## 3. API Contract Specifications

All endpoints are mounted under both `/api/v1/resident` and `/resident`.

### 3.1 `POST /api/v1/resident/camps/{camp_id}/join`
Join an open camp in the resident's society.

- **Security**: Guarded by `require_role("resident")` and `require_csrf`.
- **Path Parameter**: `camp_id: UUID`
- **Response `201 Created`**:
```json
{
  "id": "e4f8b22e-b6e2-45e5-8027-e8fa8bc7c569",
  "camp_id": "f040d45f-9691-4e4e-8ab6-1775eb1e73f8",
  "resident_id": "90a3cce6-e2e6-4450-8c79-a4cee5f65c39",
  "status": "joined",
  "quoted_price_paise": 72000,
  "final_price_paise": null,
  "slot_starts_at": null,
  "created_at": "2026-11-19T16:45:00Z",
  "cancelled_at": null,
  "camp": {
    "id": "f040d45f-9691-4e4e-8ab6-1775eb1e73f8",
    "title": "Monsoon AC Filter & Deep Clean",
    "service_name": "AC Cleaning & Tune-Up",
    "status": "open",
    "starts_at": "2026-11-25T04:30:00Z",
    "ends_at": "2026-11-25T10:30:00Z",
    "current_provisional_price_paise": 72000,
    "current_discount_pct": 10,
    "active_participants": 3,
    "spots_remaining": 5
  }
}
```

- **Error Codes**:
  - `401 Unauthorized`: Missing or invalid session credentials.
  - `403 Forbidden`: Authenticated user is not a resident, or CSRF check failed.
  - `404 Not Found`: Camp does not exist or belongs to another society.
  - `409 Conflict`: Camp is full (`"Camp has reached maximum participant capacity"`) or resident already has an active booking (`"You already have an active booking in this camp"`).
  - `422 Unprocessable Content`: Join deadline has passed or camp is not in `open` state.

---

### 3.2 `POST /api/v1/resident/camps/{camp_id}/leave`
Leave (cancel) the resident's active booking in a camp.

- **Security**: Guarded by `require_role("resident")` and `require_csrf`.
- **Path Parameter**: `camp_id: UUID`
- **Response `200 OK`**:
```json
{
  "id": "e4f8b22e-b6e2-45e5-8027-e8fa8bc7c569",
  "camp_id": "f040d45f-9691-4e4e-8ab6-1775eb1e73f8",
  "status": "cancelled",
  "cancelled_at": "2026-11-19T17:00:00Z"
}
```

- **Error Codes**:
  - `401 Unauthorized`: Missing session.
  - `403 Forbidden`: Role / CSRF failure.
  - `404 Not Found`: No active booking found for resident in this camp.
  - `422 Unprocessable Content`: Less than 24 hours remain before camp service window starts.

---

### 3.3 `GET /api/v1/resident/bookings`
List all bookings for the currently authenticated resident.

- **Security**: Guarded by `require_role("resident")`.
- **Response `200 OK`**: Array of booking items ordered by `created_at DESC` (active bookings first).
```json
[
  {
    "id": "e4f8b22e-b6e2-45e5-8027-e8fa8bc7c569",
    "camp_id": "f040d45f-9691-4e4e-8ab6-1775eb1e73f8",
    "status": "joined",
    "quoted_price_paise": 72000,
    "final_price_paise": null,
    "slot_starts_at": null,
    "created_at": "2026-11-19T16:45:00Z",
    "cancelled_at": null,
    "camp_title": "Monsoon AC Filter & Deep Clean",
    "service_name": "AC Cleaning & Tune-Up",
    "camp_status": "open",
    "starts_at": "2026-11-25T04:30:00Z",
    "ends_at": "2026-11-25T10:30:00Z"
  }
]
```

---

### 3.4 `GET /api/v1/resident/bookings/{booking_id}`
Retrieve full details of a specific booking belonging to the resident.

- **Security**: Guarded by `require_role("resident")`.
- **Path Parameter**: `booking_id: UUID`
- **Response `200 OK`**: Detailed booking model including camp metadata and pricing breakdown.
- **Error Codes**:
  - `404 Not Found`: Booking does not exist or belongs to another resident.

---

## 4. Concurrency Implementation Architecture

```
                       [ Incoming Join Request ]
                                  │
                                  ▼
               BEGIN TRANSACTION (session.begin())
                                  │
                                  ▼
         SELECT * FROM camps WHERE id = :id FOR UPDATE;  <── Exclusive row lock on Camp
                                  │
                                  ├── Camp exists & society matches? (If no -> ROLLBACK & 404)
                                  ├── Camp status == "open"? (If no -> ROLLBACK & 422)
                                  ├── now() < join_deadline? (If no -> ROLLBACK & 422)
                                  │
                                  ▼
      SELECT COUNT(*) FROM bookings WHERE camp_id = :id AND status != 'cancelled';
                                  │
                                  ├── Active bookings < max_participants? (If no -> ROLLBACK & 409)
                                  │
                                  ▼
      SELECT * FROM bookings WHERE camp_id = :id AND resident_id = :resident_id AND status != 'cancelled';
                                  │
                                  ├── Already active? (If yes -> ROLLBACK & 409)
                                  │
                                  ▼
     Compute new quote via Phase 3 pricing service for (count + 1)
                                  │
                                  ▼
     INSERT INTO bookings (camp_id, resident_id, status='joined', quoted_price_paise=...)
                                  │
                                  ▼
                           COMMIT TRANSACTION
```

The `FOR UPDATE` lock serializes all join attempts against the same camp. This guarantees:
1. No two concurrent threads can calculate available spots simultaneously.
2. The count check is authoritative.
3. The database partial unique index acts as a second, immutable defense layer against duplicate joins.

---

## 5. Implementation Roadmap & Steps

1. **Step 1: Pydantic v2 Schemas** (`backend/app/schemas/booking.py`):
   - Input/output schemas with `extra="forbid"`.
   - `BookingDetailResponse`, `BookingListItemResponse`, `BookingLeaveResponse`.

2. **Step 2: Domain Exceptions** (`backend/app/exceptions.py`):
   - `CampNotFoundError`, `CampClosedError`, `JoinDeadlinePassedError`.
   - `CampOvercapacityError`, `DuplicateBookingError`, `LateCancellationError`, `BookingNotFoundError`.
   - Registered in exception handlers mapping to appropriate HTTP status codes (404, 409, 422).

3. **Step 3: Domain Service** (`backend/app/services/camp_resident.py`):
   - Implement `join_camp_with_lock(session, resident, camp_id, now=None)`.
   - Implement `leave_camp(session, resident, camp_id, now=None)`.
   - Implement `list_resident_bookings(session, resident)`.
   - Implement `get_resident_booking(session, resident, booking_id)`.

4. **Step 4: API Endpoints & Router Mounting** (`backend/app/api/v1/resident.py` & `backend/app/api/router.py`):
   - Mount `POST /camps/{camp_id}/join`, `POST /camps/{camp_id}/leave`.
   - Mount `GET /bookings`, `GET /bookings/{booking_id}`.
   - Dual-mount under `/api/v1/resident/` and `/resident/`.

5. **Step 5: Automated Testing Suite** (`backend/tests/test_resident_bookings.py`):
   - Unit tests for all business rules: society isolation, deadline, capacity limit, duplicate active booking, re-join after leave, 24-hour leave cutoff.
   - Concurrency tests: multithreaded concurrent joins competing for 1 remaining spot.
   - Verification of 100% passing test suite.
