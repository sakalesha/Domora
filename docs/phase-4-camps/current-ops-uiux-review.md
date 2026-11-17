# Domora Operations Portal: Current UI/UX Design & Critique Guide

**Document Purpose**: This document provides a complete breakdown of the **currently implemented UI/UX for Domora's Ops Portal** (built in Phase 4a). Use this document to review the current implementation, share it with product designers, and request targeted design improvements.

---

## 1. Context & User Profile

- **Product**: Domora — Apartment Society Group-Buying Service Platform (Urban India, e.g. Bengaluru).
- **User Persona**: **Operations Coordinator (Ops)**.
  - High-frequency desktop user managing apartment service camps (Pest Control, AC Cleaning, etc.).
  - Needs high information density, clear operational status, real-time booking velocity, and error prevention when configuring time windows and volume-discount pricing tiers.
- **Current Technology**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7.

---

## 2. Global Design System & Tokens in Code

The current UI uses the following design tokens (defined in `frontend/src/index.css` and Tailwind utility classes):

| Token Category | Token / Class | Hex / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Surfaces** | `bg-canvas` | `#F8FAF9` | Warm off-white page background |
| | `bg-surface` | `#FFFFFF` | Card, modal, and drawer panels |
| **Borders** | `border-border` | `#718784` (softened with `/30` to `/50`) | Card containers and dividers |
| **Text** | `text-ink` | `#142321` | High-contrast headings and primary labels |
| | `text-body` | `#30413F` | Paragraphs and standard table text |
| | `text-muted` | `#586B68` | Secondary labels, timestamps, helper text |
| **Brand Accent** | `bg-accent` / `text-accent` | `#0F766E` (Deep Teal) | Primary actions, links, active highlights |
| | `hover:bg-accent-pressed` | `#0B625C` | Button hover and pressed states |
| **Status Pills** | `open` | Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`) | Camp open for resident bookings |
| | `confirmed` | Teal (`bg-teal-50 text-teal-800 border-teal-200`) | Price locked, slots scheduled (disentangled from Amber warnings) |
| | `in_progress` | Sky Blue (`bg-sky-50 text-sky-800 border-sky-200`) | Technician on site, jobs underway |
| | `completed` | Purple (`bg-purple-50 text-purple-800 border-purple-200`) | All jobs finished with photos |
| | `cancelled` | Rose (`bg-rose-50 text-rose-800 border-rose-200`) | Cancelled by ops with reason |

---

## 3. Current Screen-by-Screen Implementation

### Screen 1: Ops Dashboard (`/ops` and `/ops/camps`)
**Component**: `frontend/src/pages/ops/OpsDashboardPage.tsx`

#### Layout & Visual Hierarchy
1. **Top Navigation Bar**:
   - Left: Brand mark (Teal rounded square with "D"), Title ("Domora Operations"), Subtitle ("Camp management & capacity planner").
   - Right: Logged-in user badge ("Signed in as Asha"), Primary CTA button (`+ Create Camp` in solid teal), and "Log out" outline button.
2. **Filter Tabs Bar**:
   - Horizontal pill tabs: `All Camps`, `Open`, `Confirmed`, `In Progress`, `Completed`, `Cancelled`.
   - Active tab uses high-contrast ink pill (`bg-ink text-white`); inactive tabs use soft surface pills.
3. **Camps Grid**:
   - 2-column responsive card layout (`grid gap-5 md:grid-cols-2`).
   - **Card Anatomy**:
     - *Header*: Society badge (`Sunrise Heights • Bengaluru` in teal uppercase tracking), Camp title (H2, bold ink), Service name, and `CampStatusBadge` on the right.
     - *Window Timing Block*: 3-line metadata (Service window date/time, Slot duration + max slots, Join deadline).
     - *Capacity Progress Bar*: Visual bar showing fill percentage (`bg-accent`), booking count (`4 / 12 homes`), spots remaining, and minimum required threshold for confirmation.
     - *Financial & Vendor Snapshot*: Current estimated price (e.g. `₹720` bold) with struck-through base price (`₹800`), and Vendor status (`✓ CoolCare Aircon` in green or `⚠️ Unassigned` in amber).
     - *Card Footer*: Full-width outlined button: `View Camp Details & Roster →`.
4. **Empty & Loading States**:
   - Loading: 4-card shimmer pulse skeleton.
   - Empty: Dashed container with emoji icon, clear explanatory copy, and `+ Create First Camp` button.
   - Error: Red alert box with inline "Try again" retry trigger.

---

### Screen 2: Create Camp Form (`/ops/camps/new`)
**Component**: `frontend/src/pages/ops/CreateCampPage.tsx`

#### Layout & Interactive Form Sections
A single-column, 640px–800px centered form structured into 4 logical card panels:

1. **Card 1: Camp Location & Service**:
   - Dropdown: Target Society (pre-populated with active societies).
   - Dropdown: Service Catalog (AC Deep Cleaning, Pest Control). Selecting a service auto-suggests the camp title.
   - Text Input: Camp Title (editable).
2. **Card 2: Scheduling & Slots Capacity**:
   - Inputs: Window Starts At (datetime-local), Window Ends At (datetime-local), Slot Duration (20, 30, 45, 60 minutes).
   - **Live Capacity Calculation Badge**:
     - Automatically computes: `(ends_at - starts_at) // slot_minutes`.
     - Displays badge: `Window: 6h = 12 slots`.
   - Inputs: Min Participants (to confirm) and Max Participants (validated $\le$ window capacity).
   - Input: Join Deadline with helper text displaying the minimum 24-hour advance buffer (`Must be before: 29 Nov 2026, 09:00 AM`).
3. **Card 3: Pricing & Group Discount Tiers**:
   - Input: Base Price in Rupees (e.g. `₹800`).
   - Dynamic Tier Builder:
     - Pre-seeded with standard 3-tier defaults (3 homes $\rightarrow$ 10%, 6 homes $\rightarrow$ 15%, 10 homes $\rightarrow$ 20%).
     - Per-row inputs: Min Participants, Discount %, and auto-calculated price badge (`= ₹720 / home`).
     - "+ Add Tier" button and "Remove" button per tier.
     - Real-time client-side validation ensuring strictly increasing headcounts and discounts.
4. **Card 4: Vendor Assignment (Optional)**:
   - Select dropdown listing verified active vendors or "Leave unassigned for now".
5. **Footer Actions**:
   - Sticky action bar with "Cancel" and primary "Launch Camp 🚀" button with submitting spinner.
   - Successful creation immediately creates the camp as `open` and navigates to its detail page.

---

### Screen 3: Camp Detail & Roster (`/ops/camps/:id`)
**Component**: `frontend/src/pages/ops/CampDetailPage.tsx`

#### Layout: 2/3 Main Column + 1/3 Side Panel
1. **Top Header**:
   - Breadcrumb link: `← All Camps`.
   - Society name & city eyebrow, Camp Title (H1), and `CampStatusBadge`.
2. **Next-Tier Incentive Banner**:
   - High-visibility banner above content:
     - `🔥 2 more neighbours needed to unlock 15% off! (Target: 6 homes • Next price: ₹680 / home)`.
     - Shows current active price badge (`₹720`).
     - Switches to purple celebration banner when top tier is achieved.
3. **Left Column (2/3 width)**:
   - *Key Metric Cards (3-column grid)*:
     1. Service Catalog: Name and internal code.
     2. Current Estimated Price: Bold price in ₹, base price, and active discount %.
     3. Capacity Status: Headcount vs Max capacity, spots available.
   - *Service Window & Schedule Card*:
     - Start time, End time, Slot duration, Total slots, Join deadline.
     - Confirmation threshold progress bar (showing distance to `min_participants`).
   - *Group Volume Discount Tiers Table*:
     - Columns: Tier number, Min Headcount, Discount %, Effective Price, Status.
     - **Active Tier Row is highlighted** in soft teal background with an `Active` pill. Unlocked tiers show `✓ Unlocked`; upcoming tiers show `Needs X more`.
   - *Participant Roster Table*:
     - Columns: Unit (bold), Resident Name, Phone, Joined Timestamp, Quoted Price, Booking Status (`joined`).
     - Empty state with guidance text when no bookings have occurred yet.
4. **Right Column (1/3 width)**:
   - *Service Vendor Card*:
     - Displays assigned vendor name & phone, or an amber warning (`⚠️ No vendor assigned yet. Must be assigned before confirmation`).
     - Dropdown to select/change vendor with an "Update Vendor Assignment" button and instant toast notice.
   - *Lifecycle Actions Card (Phase 4d Preview)*:
     - Placeholder buttons for "Confirm Camp & Lock Price" and "Cancel Camp" with reason.

---

## 4. Strengths of the Current Implementation

1. **Strict Business Integrity**:
   - Integer paise arithmetic and exact bank rounding prevent financial drift.
   - Live slot calculation ensures operations cannot accidentally configure a camp with more participants than available time slots.
2. **Clear Operational Transparency**:
   - Active discount tier and next milestone gap are calculated dynamically and highlighted.
   - Unassigned vendors are immediately flagged with high visual priority.
3. **High Information Density without Clutter**:
   - Clean 4px/8px grid with clear typography contrast.
   - All critical metrics (slots, prices, deadlines, vendor status) visible without scrolling on standard 1080p/laptop screens.

---

## 5. Potential Improvement Areas & Questions for the Designer

When presenting this UI to a product designer or AI design reviewer, use the following prompts to gather structured feedback:

### Area 1: Operational Efficiency & Table vs Card Density
> *"The Ops Dashboard currently uses a 2-column card grid (`OpsDashboardPage.tsx`). For an ops coordinator managing 20+ active camps across 10 societies, should we introduce a dense tabular view toggle (with sorting by urgency/deadline), or does the card view provide better situational awareness for group-buying metrics?"*

### Area 2: Deadline Urgency & At-Risk Camp Visuals
> *"How can we better visualize camps that are approaching their 24h join deadline but have not yet reached their `min_participants` confirmation threshold? What visual treatment (e.g. countdown chips, amber/red urgency borders, 'At Risk' badge) would best help ops prioritize outreach?"*

### Area 3: Roster Sequencing & Slot Timing
> *"In Phase 4d, bookings will receive consecutive sequential visit slots (e.g. 09:00, 09:30, 10:00). In the current Participant Roster on `CampDetailPage.tsx`, how should scheduled visit slots be visually represented alongside the resident's join sequence and unit number?"*

### Area 4: Tier Builder Micro-Interactions
> *"In `CreateCampPage.tsx`, ops configures tiers by adding rows with min participants and discount %. Could this be improved with an interactive slider or stepped graphic showing the pricing curve, or is the tabular row editor the fastest for repeated data entry?"*

### Area 5: Mobile / Tablet Quick-Lookups
> *"While Ops is desktop-first, coordinators occasionally inspect camps from a phone or tablet on-site. How can the 2/3 + 1/3 split on `CampDetailPage.tsx` collapse most effectively on smaller viewports without burying the participant roster?"*

---

## 6. How to Run & Inspect Live

```powershell
# 1. Start backend server
.venv\Scripts\uvicorn app.main:app --reload --port 8000

# 2. In another terminal, start frontend dev server
npm --prefix frontend run dev
```

Log in with seeded ops credentials (`ops_bangalore` / `password123`) to explore the screens at `http://localhost:5173/ops`.

---

## 7. Modernized Ops Portal UI/UX Architecture (Phase 4a Design Engineering Upgrade)

Following the design review and applying specialized UI/UX skill methodologies (`frontend-design`, `emil-design-eng`, `impeccable-design-polish`, `design-taste-frontend`), the portal was upgraded with an elite operational SaaS design language:

### 7.1 Design Engineering Audit & Polish Matrix

| Area | Before | After | Why (`emil-design-eng` / `frontend-design`) |
| :--- | :--- | :--- | :--- |
| **Shell & Navigation** | Ad-hoc duplicate header per page | Unified responsive `OpsLayout` with sidebar, breadcrumbs & status pill | Eliminates header drift, creates persistent operational context and scannable navigation |
| **Icons** | Emojis (`🔥`, `⚠️`, `🚀`, `✓`) | Crisp SVG icon library (`components/icons/Icons.tsx`) | Emoji render inconsistently across OSs and look like a consumer chat app; SVGs project institutional SaaS trust |
| **Camp Status Colours** | `confirmed` was Amber | `confirmed` is Teal (`bg-teal-50 text-teal-800 border-teal-200`) | Disentangles confirmation status from Amber warning chips (e.g. Unassigned Vendor, At-Risk urgency) |
| **Dashboard Layout** | 2-column card grid only | Dense Sortable Table (default) + Visual Cards toggle | Ops coordinators triage 20+ camps across 10 societies; a 1080p screen displays 15+ table rows vs 4 cards |
| **Operational Urgency** | Generic deadline timestamp | Explicit `RiskBadge` chips (`Closes in 4h • Needs 2 more`) | Instant identification of camps that fail minimum confirmation threshold within 24h cutoff |
| **Capacity Visualizer** | Simple percentage bar | Multi-Milestone meter with Min Threshold Notch (`w-0.5 bg-ink`) & Tier ticks | Ops can instantly see if the camp is above or below the critical confirmation barrier |
| **Camp Creation Flow** | Direct unconfirmed submit to live `open` | 2-column layout + Live Pricing Ladder + Pre-Launch Review Dialog | Prevents accidental pricing errors going live to residents of an apartment society |
| **Window Slot Math** | Dropped remainder minutes silently | Displays calculated slots + leftover buffer notice (`+15m buffer`) | Operational transparency: ops understands why a 6h 15m window yields 8 slots of 45m |
| **Camp Detail Tabs** | Monolithic 2/3 + 1/3 layout | Unified Tabs: `Roster & Visits`, `Overview & Schedule`, `Group Tiers` | Roster is primary triage surface; sticky table header, tabular figures, and tap-to-call link for technicians |
| **Micro-Interactions** | Generic `transition` classes | Exact CSS properties with `:active { transform: scale(0.98); }` | Buttons feel responsive to press, inputs have high-contrast focus rings |

### 7.2 Updated Component Hierarchy
```
frontend/src/
├── components/
│   ├── icons/
│   │   └── Icons.tsx              # 20+ custom SVG icons (Heroicons/Lucide caliber)
│   ├── ops/
│   │   ├── OpsLayout.tsx          # Shared operational shell (sidebar, breadcrumbs, user chip, mobile drawer)
│   │   └── CampStatusBadge.tsx    # 5-state status chips + Critical/Warning RiskBadge
├── pages/
│   └── ops/
│       ├── OpsDashboardPage.tsx   # KPI cards, status counts, search/filter, dense table / card toggle
│       ├── CreateCampPage.tsx     # 2-col form, live pricing ladder preview, window math, review modal
│       └── CampDetailPage.tsx     # Milestone meter, Roster tab with phone call, Overview, Tier schedule
```

