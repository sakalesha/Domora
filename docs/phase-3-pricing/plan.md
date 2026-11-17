# Implementation Plan: Phase 3 — Pricing and Camp Rules

**Date**: 2026-11-17 | **Spec**: [MVP Design Section 3.4 & 3.5](../../docs/problem-&-MVP.md#34-pricing-rule)  
**Design inputs**: [Phase 3 Blueprint](../../docs/devlopment-blueprintl.md#phase-3-pricing-and-camp-rules), [Data Model](../../backend/app/models/domain.py)  

---

## 1. Summary

Implement pure, isolated business logic for group-discount pricing and camp schedule/capacity validation before any API or database transaction logic touches it. 

All monetary calculations use **integer paise** with standard **round-half-up** arithmetic (never floating point). Validation ensures price tiers strictly reward greater participation (headcounts increase, discounts never decrease) and camp parameters enforce physical constraints (slots in window, max capacity, and a mandatory 24-hour join deadline buffer).

Strict Test-Driven Development (TDD) will be followed: comprehensive test suites defining expected behaviour and edge cases will be written and proved failing before the implementation code is added.

---

## 2. Technical Context

- **Language/Version**: Python 3.11
- **Primary Dependencies**: Standard library (`dataclasses`, `datetime`, `decimal`, `typing`), `pytest`
- **Modules to Create**:
  - `backend/app/services/pricing.py`: Pure functions for tier lookup, price discounting, next-tier delta, and tier validation.
  - `backend/app/services/camp_rules.py`: Pure functions for capacity calculation and camp configuration validation.
  - `backend/tests/test_pricing.py`: Unit tests for all pricing and rounding cases.
  - `backend/tests/test_camp_rules.py`: Unit tests for capacity and window parameter validation.
- **Constraints**:
  - **No floating point arithmetic** for money. Calculations must use integer paise with explicit `ROUND_HALF_UP`.
  - **Zero external I/O**: These modules must be pure functions with zero database, network, or framework dependencies.
  - **Reversible & Idempotent**: Functions take immutable or typed inputs and return predictable outputs.

---

## 3. Constitution & Principles Check

| Principle | Result | Plan Alignment |
| :--- | :--- | :--- |
| **Never use floats for money** | PASS | Prices are stored and calculated in integer paise. Discounts rounded half up. |
| **Write tests before implementation (TDD)** | PASS | Full test suite written and confirmed failing before module implementation. |
| **Single source of truth for business logic** | PASS | Pure domain functions in `app.services` reused later by Phase 4 API endpoints. |
| **Strict physical constraints** | PASS | Whole slots in window enforce hard capacity ceiling; join deadline enforces 24h advance cutoff. |

---

## 4. Hand-Calculated Demo Reference Table

**Demo Parameters**:
- Base Price: Rs 800.00 = `80,000 paise`
- Window: 10:00 to 16:00 (360 minutes), 30-minute slots $\rightarrow$ **12 whole slots capacity**
- Tiers:
  - Tier 1: 3+ homes $\rightarrow$ 10% discount
  - Tier 2: 6+ homes $\rightarrow$ 15% discount
  - Tier 3: 10+ homes $\rightarrow$ 20% discount

| Headcount | Applied Discount | Final Price (Paise) | Final Price (INR) | Next Tier Info |
| :---: | :---: | :---: | :---: | :--- |
| **0** | 0% | 80,000 | ₹800.00 | 3 more neighbours for 10% off (target: 3) |
| **1** | 0% | 80,000 | ₹800.00 | 2 more neighbours for 10% off (target: 3) |
| **2** | 0% | 80,000 | ₹800.00 | 1 more neighbour for 10% off (target: 3) |
| **3** | **10%** | **72,000** | **₹720.00** | 3 more neighbours for 15% off (target: 6) |
| **4** | 10% | 72,000 | ₹720.00 | 2 more neighbours for 15% off (target: 6) |
| **5** | 10% | 72,000 | ₹720.00 | 1 more neighbour for 15% off (target: 6) |
| **6** | **15%** | **68,000** | **₹680.00** | 4 more neighbours for 20% off (target: 10) |
| **7** | 15% | 68,000 | ₹680.00 | 3 more neighbours for 20% off (target: 10) |
| **8** | 15% | 68,000 | ₹680.00 | 2 more neighbours for 20% off (target: 10) |
| **9** | 15% | 68,000 | ₹680.00 | 1 more neighbour for 20% off (target: 10) |
| **10** | **20%** | **64,000** | **₹640.00** | Max tier reached (None) |
| **11** | 20% | 64,000 | ₹640.00 | Max tier reached (None) |
| **12** | 20% | 64,000 | ₹640.00 | Max tier reached (None) |

---

## 5. Implementation Steps

### Step 1: Write Pricing Test Suite (`backend/tests/test_pricing.py`)
- **Objective**: Establish the full behavioral contract for pricing before writing code.
- **Coverage**:
  - Headcount below lowest tier (0, 1, 2) $\rightarrow$ 0% discount, base price.
  - Headcount exactly at tier boundaries (3, 6, 10) $\rightarrow$ exact discounts (10%, 15%, 20%).
  - Headcount between tier boundaries (4, 5, 7, 8, 9) $\rightarrow$ locked at previous tier.
  - Headcount beyond maximum tier (11, 12, 100) $\rightarrow$ capped at top discount (20%).
  - Next-tier delta calculations: correct count remaining and target discount percentage; returns `None` once top tier is reached.
  - Rounding edge cases: fractional paise rounded half-up (e.g. 49,900 paise @ 15% = 42,415 paise).
  - Invalid tier list rejection:
    - Empty tier list (valid or invalid depending on spec; default 0% if empty).
    - Decreasing discount percentages (`[Tier(3, 15), Tier(6, 10)]`) $\rightarrow$ raises `ValueError`.
    - Duplicate headcounts (`[Tier(3, 10), Tier(3, 15)]`) $\rightarrow$ raises `ValueError`.
    - Out of range discount percentages (`< 0` or `> 100`) $\rightarrow$ raises `ValueError`.
    - Non-positive headcounts (`min_participants < 1`) $\rightarrow$ raises `ValueError`.

### Step 2: Implement Pricing Module (`backend/app/services/pricing.py`)
- **Objective**: Implement clean, pure functions satisfying all tests from Step 1.
- **Components**:
  - `PriceTier` (dataclass): `min_participants: int`, `discount_pct: int`.
  - `NextTierInfo` (dataclass): `more_needed: int`, `target_participants: int`, `discount_pct: int`.
  - `PricingQuote` (dataclass): `base_price_paise: int`, `headcount: int`, `discount_pct: int`, `final_price_paise: int`, `next_tier: NextTierInfo | None`.
  - `validate_price_tiers(tiers: Sequence[PriceTier]) -> tuple[PriceTier, ...]`: Sorts and validates integrity.
  - `calculate_discount_pct(headcount: int, tiers: Sequence[PriceTier]) -> int`: Highest achieved tier discount.
  - `calculate_discounted_price_paise(base_price_paise: int, discount_pct: int) -> int`: Integer paise math with `ROUND_HALF_UP`.
  - `calculate_pricing_quote(base_price_paise: int, headcount: int, tiers: Sequence[PriceTier]) -> PricingQuote`: Full bundle for UI and confirmation.

### Step 3: Write Camp Rules Test Suite (`backend/tests/test_camp_rules.py`)
- **Objective**: Establish the validation contract for camp parameters and scheduling limits.
- **Coverage**:
  - Slot calculation: Exact whole slots within time window (e.g. 10:00 to 16:00 @ 30m = 12 slots).
  - Partial slot truncation: 10:00 to 16:15 @ 30m = 12 slots (remaining 15 minutes cannot form a visit).
  - Window validation: `starts_at < ends_at`.
  - Participant limits: `1 <= min_participants <= max_participants <= capacity_slots`.
  - Advance deadline: `join_deadline <= starts_at - timedelta(hours=24)` (must be at least 24 hours prior).
  - Non-negative price: `base_price_paise >= 0`.
  - Slot duration: `slot_minutes > 0`.
  - Timezone awareness: Requires UTC/timezone-aware datetimes.

### Step 4: Implement Camp Rules Module (`backend/app/services/camp_rules.py`)
- **Objective**: Implement pure functions for capacity and parameter validation.
- **Components**:
  - `calculate_capacity_slots(starts_at: datetime, ends_at: datetime, slot_minutes: int) -> int`
  - `validate_camp_parameters(starts_at: datetime, ends_at: datetime, slot_minutes: int, min_participants: int, max_participants: int, join_deadline: datetime, base_price_paise: int) -> int` (returns calculated capacity on success, raises `CampValidationError` on violation).

---

## 6. Task List

- [x] **T001**: Create `backend/tests/test_pricing.py` covering tier lookup, price calculation, next-tier delta, rounding half-up, and invalid tier lists.
- [x] **T002**: Create `backend/tests/test_camp_rules.py` covering slot calculation, partial slot handling, deadline advance cutoff, and capacity checks.
- [x] **T003**: Run pytest and confirm tests fail as expected (TDD red state).
- [x] **T004**: Implement `backend/app/services/pricing.py` with pure functions and dataclasses.
- [x] **T005**: Implement `backend/app/services/camp_rules.py` with parameter validation and slot calculation.
- [x] **T006**: Run test suite and verify all pricing and camp rule tests pass (TDD green state).
- [x] **T007**: Validate demo numbers: 3 homes = Rs 720, 6 homes = Rs 680, 10 homes = Rs 640 from base Rs 800.
- [x] **T008**: Update blueprint and progress tracker upon exit gate completion.

---

## 7. Exit Gate Verification

1. **Automated Tests**: All tests in `test_pricing.py` and `test_camp_rules.py` pass without warnings.
2. **Demo Target Check**:
   - 3 homes: Rs 720 (72,000 paise)
   - 6 homes: Rs 680 (68,000 paise)
   - 10 homes: Rs 640 (64,000 paise)
3. **No Floats**: Verified that no `float` type or division float conversions are used for currency calculations.
