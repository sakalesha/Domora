# Phase 4a Implementation Plan: Ops Camp Management

## 1. Overview & Objective

Phase 4a establishes the operations management foundation for Domora's group-buying service camps. In this sub-phase, operations personnel (`role: "ops"`) can configure and launch camps with custom volume-pricing tiers, assign service vendors, inspect real-time participant bookings, and view current provisional pricing quotes.

All camp parameters and pricing structures leverage the pure domain engines built in Phase 3 ([`pricing.py`](file:///c:/Users/ronad/OneDrive/Desktop/Projects/Domora-New/backend/app/services/pricing.py) and [`camp_rules.py`](file:///c:/Users/ronad/OneDrive/Desktop/Projects/Domora-New/backend/app/services/camp_rules.py)), enforcing business integrity before database persistence.

---

## 2. Core Business Rules & Invariants (4a)

1. **Role Authorization (Rule 8)**:
   - Only users with `role == "ops"` and `is_active == True` can create camps, list ops camp overviews, and assign vendors.
   - Resident (`role: "resident"`) and Vendor (`role: "vendor"`) access to `/ops/*` endpoints is strictly rejected with `403 Forbidden`.
   - Unauthenticated requests are rejected with `401 Unauthorized`.

2. **Camp Parameter Validation (Rules 3.5 & 3.6)**:
   - `starts_at < ends_at`: Service window must be strictly positive.
   - `slot_minutes > 0`: Default 30 or 60 minutes.
   - `capacity_slots = (ends_at - starts_at) // slot_minutes`.
   - `max_participants <= capacity_slots`: Bookings can never exceed whole time slots.
   - `1 <= min_participants <= max_participants`: Camp must require at least 1 resident.
   - `join_deadline <= starts_at - 24 hours`: Residents must be able to cancel up to 24h prior, and operations needs guaranteed lead time to confirm or cancel.
   - All timestamps must be timezone-aware (stored and compared in UTC).

3. **Pricing Tier Invariants (Rule 3.4)**:
   - `base_price_paise >= 0`: Stored strictly as integer paise (e.g., ₹800.00 $\rightarrow$ 80,000 paise).
   - Tiers must have strictly increasing `min_participants` thresholds ($t_{i+1} > t_i$).
   - Tiers must have non-decreasing `discount_pct` ($0 \le d_i \le d_{i+1} \le 100$).
   - Tier `min_participants` cannot exceed `max_participants`.

4. **Vendor Assignment Invariants (Rule 7)**:
   - A vendor assigned to a camp must exist, be active, and possess `role == "vendor"`.
   - Vendor can be assigned at camp creation or updated later via `PATCH /ops/camps/{camp_id}/vendor`.

5. **Entity Integrity**:
   - `society_id` must reference an existing society in the database.
   - `service_id` must reference an existing active service (e.g. pest control, AC service).
   - `created_by` is set automatically from the authenticated Ops user.
   - `status` defaults to `"open"`.

---

## 3. API Contract Specifications

All endpoints are mounted under `/ops` (and accessible under `/api/ops` via Vercel rewrite).

### 3.1 `POST /ops/camps`
Create a new camp with pricing tiers in a single atomic database transaction.

**Headers**:
- `Cookie: domora_session=<token>`
- `X-CSRF-Token: <token>` (for mutating browser requests)

**Request Body**:
```json
{
  "society_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "service_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "title": "Spring AC Deep Cleaning Camp",
  "starts_at": "2026-12-01T09:00:00Z",
  "ends_at": "2026-12-01T15:00:00Z",
  "slot_minutes": 30,
  "min_participants": 3,
  "max_participants": 12,
  "join_deadline": "2026-11-29T18:00:00Z",
  "base_price_paise": 80000,
  "vendor_id": "optional-vendor-uuid",
  "price_tiers": [
    { "min_participants": 3, "discount_pct": 10 },
    { "min_participants": 6, "discount_pct": 15 },
    { "min_participants": 10, "discount_pct": 20 }
  ]
}
```

**Response (201 Created)**:
Returns full `CampDetailResponse` including created IDs, timestamps, society name, service name, vendor name, and formatted tiers.

**Error Responses**:
- `400 Bad Request`: Parameter validation failure (e.g., deadline < 24h, tiers non-monotonic, max > capacity).
- `401 Unauthorized`: Missing or expired credentials.
- `403 Forbidden`: Non-ops role.
- `404 Not Found`: Referenced `society_id`, `service_id`, or `vendor_id` does not exist.

---

### 3.2 `GET /ops/camps`
List all camps with high-level operational metrics.

**Query Parameters**:
- `society_id` (optional): Filter camps by society.
- `status` (optional): Filter by camp status (`open`, `confirmed`, `in_progress`, `completed`, `cancelled`).

**Response (200 OK)**:
```json
[
  {
    "id": "camp-uuid",
    "society": {
      "id": "soc-uuid",
      "name": "Sunrise Heights",
      "city": "Bengaluru"
    },
    "service": {
      "id": "srv-uuid",
      "code": "ac_service",
      "name": "AC Deep Cleaning"
    },
    "vendor": {
      "id": "vendor-uuid",
      "full_name": "CoolCare Aircon",
      "phone": "+919800000002"
    },
    "title": "Spring AC Deep Cleaning Camp",
    "starts_at": "2026-12-01T09:00:00Z",
    "ends_at": "2026-12-01T15:00:00Z",
    "slot_minutes": 30,
    "status": "open",
    "min_participants": 3,
    "max_participants": 12,
    "capacity_slots": 12,
    "active_participants_count": 4,
    "spots_remaining": 8,
    "base_price_paise": 80000,
    "current_price_paise": 72000,
    "join_deadline": "2026-11-29T18:00:00Z",
    "created_at": "2026-11-17T10:00:00Z"
  }
]
```

---

### 3.3 `GET /ops/camps/{camp_id}`
Detailed single-camp view with participant roster and live tier breakdown.

**Response (200 OK)**:
```json
{
  "id": "camp-uuid",
  "society": { ... },
  "service": { ... },
  "vendor": { ... },
  "title": "Spring AC Deep Cleaning Camp",
  "starts_at": "...",
  "ends_at": "...",
  "slot_minutes": 30,
  "status": "open",
  "min_participants": 3,
  "max_participants": 12,
  "capacity_slots": 12,
  "base_price_paise": 80000,
  "join_deadline": "...",
  "cancelled_reason": null,
  "created_at": "...",
  "price_tiers": [
    { "min_participants": 3, "discount_pct": 10 },
    { "min_participants": 6, "discount_pct": 15 },
    { "min_participants": 10, "discount_pct": 20 }
  ],
  "pricing_quote": {
    "headcount": 4,
    "base_price_paise": 80000,
    "discount_pct": 10,
    "discounted_price_paise": 72000,
    "next_tier": {
      "min_participants": 6,
      "discount_pct": 15,
      "participants_needed": 2,
      "potential_price_paise": 68000
    }
  },
  "participants": [
    {
      "booking_id": "booking-uuid",
      "resident_id": "user-uuid",
      "full_name": "Resident One",
      "unit_label": "A-101",
      "phone": "+919900000001",
      "status": "joined",
      "quoted_price_paise": 72000,
      "final_price_paise": null,
      "slot_starts_at": null,
      "created_at": "2026-11-17T10:30:00Z"
    }
  ]
}
```

---

### 3.4 `PATCH /ops/camps/{camp_id}/vendor`
Assign or replace the assigned vendor for a camp.

**Request Body**:
```json
{
  "vendor_id": "vendor-uuid-or-null"
}
```

**Response (200 OK)**:
Returns updated camp vendor info.

---

### 3.5 Reference Data Endpoints
To power ops dropdown selectors cleanly without hardcoding IDs:
- `GET /ops/societies`: Returns list of societies (`id`, `name`, `city`, `invite_code`).
- `GET /ops/services`: Returns list of available services (`id`, `code`, `name`).
- `GET /ops/vendors`: Returns list of active vendors (`id`, `full_name`, `phone`).

---

## 4. Backend Architecture & Implementation Details

```
backend/app/
├── api/
│   ├── ops.py               # Ops route handlers (/ops/camps, /ops/societies, etc.)
│   ├── ops_schemas.py       # Pydantic v2 schemas for requests & responses
│   └── router.py            # Mounts ops router
├── services/
│   ├── camp_ops.py          # Camp lifecycle operations orchestration
│   ├── camp_rules.py        # (Phase 3) Pure camp validation logic
│   └── pricing.py           # (Phase 3) Pure pricing calculation logic
└── tests/
    └── test_camp_ops.py     # Comprehensive test suite for Phase 4a
```

### 4.1 Database Queries & Concurrency
- `create_camp`: All inserts (`Camp` and child `CampPriceTier` rows) run in one transaction. If tier insertion fails, the entire camp rolls back.
- `get_camp_detail`: Loads camp with joined relationships (`society`, `service`, `vendor`, `price_tiers`), queries active bookings (`status != 'cancelled'`), and executes `calculate_pricing_quote(...)` dynamically.
- `list_camps`: Uses SQL aggregation (`func.count(Booking.id).filter(Booking.status != 'cancelled')`) to return accurate headcount without N+1 query overhead.

---

## 5. Frontend Architecture & Ops Interface

```
frontend/src/
├── api/
│   └── ops.ts               # Typed API client for ops endpoints
├── pages/
│   └── ops/
│       ├── OpsDashboardPage.tsx   # Camp listings, status filters, metrics
│       ├── CreateCampPage.tsx     # Camp creation form with dynamic tier builder
│       └── CampDetailPage.tsx     # Camp overview, vendor assigner, participant roster
└── components/
    └── ops/
        ├── CampStatusBadge.tsx    # Semantic color pills (Open, Confirmed, etc.)
        └── TierProgressCard.tsx   # Visual tier progress indicator
```

### 5.1 Frontend Interaction Details
- **OpsDashboardPage**:
  - Displays camps in structured table/cards.
  - Filter tabs: `All`, `Open`, `Confirmed`, `In Progress`, `Completed`, `Cancelled`.
  - Displays spots filled (e.g. `4 / 12`), current estimated price (₹720), and vendor assignment status.
- **CreateCampPage**:
  - Live capacity helper: typing starts_at (e.g. 09:00) and ends_at (e.g. 15:00) with 30m slot dynamically shows *"Available Slots: 12"*.
  - Tier builder: allows adding/removing tiers with instant client-side validation ensuring monotonic headcounts and discounts.
  - Converts human-entered Rupee amounts ($\text{₹800}$) to integer paise ($80000$) automatically before transmission.
- **CampDetailPage**:
  - View full camp parameters.
  - Vendor assignment selector (instant `PATCH` update with toast/notice).
  - Resident roster table displaying joined neighbours.

---

## 6. Test Suite & Verification Matrix (`test_camp_ops.py`)

| Test Area | Case | Expected Result |
| :--- | :--- | :--- |
| **Auth & Guard** | Unauthenticated request to `/ops/camps` | `401 Unauthorized` |
| **Auth & Guard** | Resident calls `/ops/camps` | `403 Forbidden` |
| **Auth & Guard** | Vendor calls `/ops/camps` | `403 Forbidden` |
| **Creation** | Ops creates valid camp with 3 tiers & vendor | `201 Created`, DB rows present, relations linked |
| **Creation** | Ops creates camp without vendor | `201 Created`, `vendor_id` is null |
| **Validation** | End time before start time | `400 Bad Request` |
| **Validation** | Join deadline < 24h before window start | `400 Bad Request` |
| **Validation** | `max_participants` > capacity slots | `400 Bad Request` |
| **Validation** | Tiers have duplicate min_participants | `400 Bad Request` |
| **Validation** | Tiers have decreasing discount percentage | `400 Bad Request` |
| **Validation** | Negative `base_price_paise` | `422 Unprocessable Entity` / `400 Bad Request` |
| **Listing** | Ops lists camps without filters | `200 OK`, returns all camps with active booking counts |
| **Listing** | Ops filters by `society_id` and `status` | `200 OK`, returns only matching camps |
| **Detail** | Ops gets camp detail with bookings | `200 OK`, accurate `pricing_quote` and participants roster |
| **Detail** | Cancelled bookings excluded from active count | Quoted headcount only counts non-cancelled bookings |
| **Vendor Assign** | Assign valid active vendor | `200 OK`, `camp.vendor_id` updated |
| **Vendor Assign** | Assign non-existent or non-vendor user | `400 Bad Request` or `404 Not Found` |

---

## 7. Execution Tasks Checklist

- [x] **T001**: Define Pydantic request/response schemas in `backend/app/api/ops_schemas.py`.
- [x] **T002**: Implement camp ops service functions in `backend/app/services/camp_ops.py` (`create_camp`, `list_camps`, `get_camp_detail`, `assign_vendor`, reference loaders).
- [x] **T003**: Implement ops router endpoints in `backend/app/api/ops.py` and mount in `backend/app/api/router.py`.
- [x] **T004**: Write comprehensive automated tests in `backend/tests/test_camp_ops.py` covering all positive and negative cases.
- [x] **T005**: Run backend test suite (`.venv\Scripts\pytest backend`) to achieve 100% green state (132 tests passing).
- [x] **T006**: Create frontend typed API client in `frontend/src/api/ops.ts`.
- [x] **T007**: Implement `OpsDashboardPage.tsx` with camp listing, status filters, and navigation.
- [x] **T008**: Implement `CreateCampPage.tsx` with live slot calculation and dynamic tier builder.
- [x] **T009**: Implement `CampDetailPage.tsx` with camp breakdown, vendor assignment dropdown, and participant roster.
- [x] **T010**: Wire ops routes in `frontend/src/App.tsx` and connect `RoleHomePage.tsx` to the Ops Dashboard.
- [x] **T011**: Run frontend typecheck and linter (`npm run build` / `oxlint` pass with 0 errors and 0 warnings).
- [x] **T012**: Verify end-to-end ops workflow and document Phase 4a completion.

---

## 8. Exit Gate for Sub-phase 4a

1. Ops user can create a camp with valid parameters and pricing tiers; invalid parameters are rejected with clear error messages. (**PASSED**)
2. Ops user can assign/reassign an active vendor. (**PASSED**)
3. Ops user can list all camps with accurate booking counts and view full detail with participant rosters. (**PASSED**)
4. Non-ops users (residents, vendors, unauthenticated visitors) are strictly blocked with 401/403. (**PASSED**)
5. All automated backend tests (132/132) and frontend build/lint pass cleanly. (**PASSED**)
