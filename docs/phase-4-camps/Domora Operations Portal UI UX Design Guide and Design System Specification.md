# Domora Operations Portal: UI/UX Design Guide and Design System Specification

Version 1.1 · 17 November 2026 · Prepared for Sakalesh · Status: Verified & Aligned with Domora Backend Architecture

## 1. Purpose and how to use this document

This document specifies the design of the Domora Operations Portal, the internal web app the Domora support team (ops) uses to run camps, keep visits on schedule and help residents. It covers users and scope, information architecture, design tokens, components, every MVP screen, key flows, content rules, accessibility, and a build and QA plan.

It contains no implementation code. You build it; this document says what to build and how to check it. Sections 5 to 7 are the design system that every screen reuses, so read them first. Build in the order given in Section 16.

**Confidence labels.** *Fact* means it comes from your spec, database schema, or backend implementation. *Recommendation* is design guidance aligned with user experience.

### 1.3 Verified Architectural Decisions & Backend Facts

| # | Topic | Confirmed System Reality (Backend & Database) |
| --- | --- | --- |
| 1 | **Camp States** | **5 States (not 7)**: `open`, `confirmed`, `in_progress`, `completed`, `cancelled` (enforced by DB check constraint `camp_status_check`). No `Draft` (camps publish immediately as `open`), and no separate `Closed` or `Scheduled` state (`confirmed` locks the price and schedules the slots). |
| 2 | **Ops Endpoints** | Implemented in Sub-phase 4a: `POST /ops/camps` (create with tiers), `GET /ops/camps` (list with filters), `GET /ops/camps/:id` (detail with roster & quote), `PATCH /ops/camps/:id/vendor` (vendor assignment), and dropdown reference loaders (`/ops/societies`, `/ops/services`, `/ops/vendors`). Confirm and Cancel endpoints (`/confirm`, `/cancel`) follow in Phase 4d. |
| 3 | **Scheduling Rules** | Slots are whole multiples of `slot_minutes`. Bookings are assigned consecutive time slots in join order (`created_at` ASC) at camp confirmation (Phase 4d). Individual manual slot swapping is deferred in MVP to keep scheduling deterministic. |
| 4 | **Audit Trail** | Stored at the entity level: `camps.created_at`, `camps.created_by`, `camps.cancelled_reason`, `bookings.created_at`, `bookings.cancelled_at`, `job_records.started_at`, and `completed_at`. Timelines are derived from these milestone timestamps. |
| 5 | **Device Context** | Desktop-first (1280px–1440px laptop/desktop), responsive down to tablet (768px). Resident and Vendor portals are phone-first (360px–420px). |
| 6 | **Business Rules** | Minimum participants rule strictly enforced (`min_participants >= 1`; confirmation blocked below minimum); join deadline strictly $\ge 24$h before window start; base price and tiers stored as integer paise. |
| 7 | **Visit Photos** | Visit photos **are** in MVP (Phase 5). `job_records` requires `before_photo_path` and `after_photo_path` via private Supabase Storage signed URLs. |

## 2. Product context

### 2.1 Users and context of use

The only user is the **operations team member**. Illustrative persona, not research: Asha, an operations executive who spends most of the day at a desk on a laptop, runs several camps at once, repeats the same tasks daily, and works under pressure when a vendor cancels or a resident calls.

Three facts shape every decision: sessions are long, tasks repeat, and mistakes touch real households (a wrong reassignment means a technician does not arrive). So the portal favours speed, clarity of status and protection against accidental changes over visual flair.

### 2.2 Jobs to be done

| Job | How the portal supports it |
| --- | --- |
| Create a camp for a society and service | Camp form with tiered pricing (8.4) |
| Assign a vendor and confirm the date | Vendor selector, status stepper (8.5) |
| See who joined and how close the camp is to the next discount tier | Participants tab, tier progress bar (8.5) |
| Move a camp or a visit when something changes | Edit visit drawer with reason and impact summary (8.6) |
| Replace a vendor who is unavailable | Reassign vendor action with affected-visit count (9.2) |
| Check the work was done | Before and after photos (8.10, conditional) |
| Help a resident who cannot sign in | User lookup (8.9) |
| Know what needs attention today | Dashboard (8.2) |

### 2.3 MVP scope

| Area | Scope |
| --- | --- |
| Dashboard | MVP |
| Camps: list, create, edit, detail, participants | MVP |
| Visits: list, reschedule, reassign | MVP |
| Vendors | MVP, read-only (vendors are seeded) |
| Societies and invite codes | MVP (regenerate code depends on backend, VERIFY) |
| Users lookup | MVP, read-only |
| Sign-in recovery actions (reset password, verify phone) | Deferred: OTP and reset are not built |
| Notification log | Deferred |
| Vendor approval queue | Deferred |
| Reports and analytics | Deferred |
| Job photo viewer | Conditional on photos being in your MVP visit model |

### 2.4 Success criteria

These are targets for your usability test (Section 18), not guarantees.

- A first-time ops user creates and publishes a camp in under 3 minutes without help.
- Reassigning a vendor takes under 1 minute.
- Finding a user takes under 30 seconds.
- No participant in the test triggers a destructive action by accident.

## 3. Design principles

| Principle | What it means in practice |
| --- | --- |
| Status first | Every camp and visit shows a status chip wherever it appears. |
| Calm density | More information per screen than the resident app, held together by hierarchy and whitespace, not by borders everywhere. |
| Safe by default | Destructive or resident-affecting actions need a confirmation that states the consequence, and a reason where residents are affected. |
| One pattern per task | Create, edit, cancel and filter work the same way on every screen. |
| Consequences before commitment | Say 'This moves 14 visits to Vendor B' before the button is pressed, not after. |
| Built for repetition | Keyboard friendly, filters remembered in the URL, no needless modals. |
| Honest states | Empty, loading and error states say what happened and what to do. Never show a made-up number. |

## 4. Information architecture

### 4.1 Navigation

| Group | Label | Route | Purpose | Scope |
| --- | --- | --- | --- | --- |
| Operations | Dashboard | /ops | Daily overview | MVP |
| Operations | Camps | /ops/camps, /ops/camps/new, /ops/camps/:id | Manage camps | MVP |
| Operations | Visits | /ops/visits | All visits, reschedule and reassign | MVP |
| Directory | Vendors | /ops/vendors, /ops/vendors/:id | Read-only vendor directory | MVP |
| Directory | Societies | /ops/societies, /ops/societies/:id | Societies and invite codes | MVP |
| Directory | Users | /ops/users | Find a user | MVP |
| Top bar | Profile menu | none | Name, role, log out | MVP |

A separate Visits page is a *Recommendation*: rescheduling is a daily task and should not require opening each camp.

### 4.2 Navigation rules

- Sidebar items are grouped as above; the active item has an accent bar and bold label.
- Counts appear only where they mean 'needs action' (for example camps without a vendor). No decorative badges.
- Detail pages show a breadcrumb (Camps / Camp name). The browser tab title always names the current page.
- All /ops routes are guarded: only the ops role can open them; other roles are redirected to their own home using the guard from the auth guide.

### 4.3 URL conventions

Filters, tab, sort and page live in query parameters so refresh, back and shared links reproduce the same view. Example shape: /ops/camps?status=open&society=ID&page=2. Do not put personal data (names, phone numbers) in URLs.

## 5. Design tokens

Tokens are named by purpose, not by colour, so components never contain raw hex values. Recommended CSS variable names are shown in 5.10.

### 5.1 Colour

**Brand and neutrals**

| Token | Value | Use |
| --- | --- | --- |
| primary-600 | #0F766E | Primary buttons, links, active nav, focus ring |
| primary-700 | #115E59 | Primary hover and pressed |
| primary-100 | #CCFBF1 | Selected row, subtle highlights |
| primary-50 | #F0FDFA | Active nav background, hover tint |
| neutral-0 | #FFFFFF | Cards, inputs, modals |
| neutral-50 | #F8FAFC | App background |
| neutral-100 | #F1F5F9 | Table header, hover rows |
| neutral-200 | #E2E8F0 | Default borders and dividers |
| neutral-300 | #CBD5E1 | Strong borders, disabled fills |
| neutral-500 | #64748B | Secondary text, placeholders, icons |
| neutral-700 | #334155 | Body text |
| neutral-900 | #0F172A | Headings, high emphasis |

**Semantic**

| Role | Text and icon | Background | Solid (buttons) |
| --- | --- | --- | --- |
| Success | #166534 | #DCFCE7 | #15803D |
| Warning | #92400E | #FEF3C7 | #B45309 |
| Danger | #B91C1C | #FEE2E2 | #DC2626 |
| Info | #1E40AF | #DBEAFE | #1D4ED8 |
| Violet (in progress) | #5B21B6 | #EDE9FE | #6D28D9 |

**Contrast.** These pairs were chosen to target WCAG AA (4.5:1 for text), but I have not measured every combination. Check each text and background pair in a contrast checker before locking the tokens. (Confidence: medium.)

**Camp and booking status colours (Confirmed: 5-state machine)**

| Status | Chip colour & CSS tokens | Meaning |
| --- | --- | --- |
| **Open** | Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200 dot-emerald-500`) | Camp is active; residents can join/leave; provisional tier discount applies |
| **Confirmed** | Teal (`bg-teal-50 text-teal-800 border-teal-200 dot-teal-500`) | Min participants reached + vendor assigned; final price locked; consecutive slots scheduled (disentangled from Amber warnings) |
| **In progress** | Sky Blue (`bg-sky-50 text-sky-800 border-sky-200 dot-sky-500`) | Service window live; technician uploaded 1st before-photo; visits underway |
| **Completed** | Purple (`bg-purple-50 text-purple-800 border-purple-200 dot-purple-500`) | All scheduled visits completed with before + after photos |
| **Cancelled** | Rose / Danger (`bg-rose-50 text-rose-800 border-rose-200 dot-rose-500`) | Cancelled by ops with required reason OR all registered residents left |

*Booking status synchronization:* When a camp is `open`, bookings are `joined`. When confirmed, bookings move to `scheduled` with sequential slot times. When a technician commences, the booking moves to `in_progress`, then `completed`. If a resident leaves or camp cancels, booking is `cancelled`.

Rule: colour never carries meaning alone. Every chip has a text label.

### 5.2 Typography

Typeface: Inter, falling back to the system UI font. Use tabular numerals in tables, prices and counts so digits line up.

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Page title (H1) | 24 / 32 | 600 | One per page |
| Section title (H2) | 20 / 28 | 600 | Major blocks |
| Card title (H3) | 16 / 24 | 600 | Card and drawer headers |
| Body | 14 / 20 | 400 | Default text, table cells |
| Body large | 16 / 24 | 400 | Forms on phones, dialogs |
| Label | 14 / 20 | 500 | Form labels, table headers |
| Caption | 12 / 16 | 400 | Helper text, timestamps |
| Mono | 13 / 20 | 400 | IDs, invite codes |

On screens under 768 px, input text is 16 px so iOS Safari does not zoom on focus. Limit line length in text blocks to about 70 characters.

### 5.3 Spacing

Base unit 4 px. Allowed steps: 4, 8, 12, 16, 24, 32, 48, 64. Default gap inside a card is 16; between cards 24; page padding 24 (16 on phones). If you are choosing a number not on this list, pick the nearest one on it.

### 5.4 Radius, borders, elevation

| Token | Value | Use |
| --- | --- | --- |
| radius-sm | 4 px | Checkboxes, small tags |
| radius-md | 8 px | Buttons, inputs, dropdowns |
| radius-lg | 12 px | Cards, modals, drawers |
| radius-full | 999 px | Status chips, avatars |
| border-default | 1 px neutral-200 | Cards, tables, inputs |
| shadow-1 | small soft shadow | Dropdowns, tooltips |
| shadow-2 | medium soft shadow | Modals, drawers |

Recommendation: prefer borders over shadows for structure, and keep shadows for things that float above the page.

### 5.5 Motion

Hover and focus changes: 120 ms. Drawers, modals, dropdowns: 200 ms ease-out. Nothing longer than 300 ms. Respect the reduced-motion setting by removing slides and fades. Motion explains a change (a drawer comes from the side it belongs to); it is never decoration.

### 5.6 Breakpoints

| Name | Min width | Layout |
| --- | --- | --- |
| sm | 640 | Phone landscape |
| md | 768 | Tablet |
| lg | 1024 | Laptop |
| xl | 1280 | Desktop |

### 5.7 Layering

Base 0, sticky table header 10, sidebar 20, dropdown 30, drawer 40, modal 50, toast 60. Do not invent other values.

### 5.8 Iconography

One outline icon set (Lucide is a good fit for React). 16 px inside buttons and tables, 20 px in navigation, 1.75 px stroke, colour follows the text it sits with. Icon-only buttons need an accessible name and a tooltip.

### 5.9 Dark mode

Deferred. Semantic naming in 5.10 makes it possible later without touching components.

### 5.10 Suggested variable names

Colour: color-bg-app, color-bg-surface, color-bg-subtle, color-border, color-text-primary, color-text-secondary, color-accent, color-accent-hover, color-success, color-warning, color-danger, color-info. Others: space-1 to space-16, radius-sm, radius-md, radius-lg, shadow-1, shadow-2, font-body, font-mono. Status chips read from a single status-to-colour map so a colour change happens in one place.

## 6. Layout system

### 6.1 App shell

- Sidebar: 240 px wide, fixed, collapsible to 64 px (icons with tooltips).
- Top bar: 56 px high, holds the sidebar toggle on small screens, global page title context and the profile menu.
- Content: padding 24 px, max width 1280 px centred. Tables may use the full width.

### 6.2 Grid

12 columns with 24 px gutters from lg upward. On phones, 4 columns with 16 px gutters.

### 6.3 Responsive behaviour

| Width | Sidebar | Tables | Forms |
| --- | --- | --- | --- |
| 1280 and up | Expanded | Full table | Single column, 640 px max |
| 1024 to 1279 | Collapsed to icons, expandable | Full table, low-priority columns hidden | Same |
| 768 to 1023 | Overlay drawer from a menu button | Reduced columns | Same |
| Under 768 | Overlay drawer | Stacked cards showing the 3 most important fields | Full width, primary action pinned to the bottom |

Column priority (what disappears first on narrow screens) is set per table in Section 8.

### 6.4 Page anatomy

Top to bottom: breadcrumb (detail pages only), page header (H1, status chip, primary action on the right), tabs if any, filter bar, content, pagination. Keep the primary action in the same place on every page.

### 6.5 Detail page layout

Two columns from lg: main content 8 of 12 columns, summary side card 4 columns (key facts, status, quick actions). On smaller screens the side card moves above the main content.

## 7. Component specifications

Build each component once, in all its states, before using it on a screen.

### 7.1 Button

| Variant | Look | Use |
| --- | --- | --- |
| Primary | Accent fill, white text | One per view area: the main next step |
| Secondary | White, border, dark text | Alternatives, Cancel |
| Ghost | No border, text only | Low emphasis, toolbar actions |
| Destructive | Danger fill | Only for destructive actions, normally inside a confirmation |
| Link | Accent text, underline on hover | Navigation inside text |

Sizes: small 28 px (table rows), medium 36 px (default), large 44 px (phones, drawers on touch). States: default, hover, focus (2 px accent outline with 2 px offset), pressed, disabled, loading (spinner replaces icon, label stays, width does not change, clicks ignored). Disabled buttons that hide an action ops might expect must explain why in a tooltip ('Cancel is unavailable once visits are in progress').

Labels are verb plus object: Create camp, Save changes, Assign vendor. Avoid OK, Submit, Yes.

### 7.2 Form controls

| Control | Spec |
| --- | --- |
| Text input | 40 px tall, label above, helper text below (caption), required fields unmarked and optional ones labelled (optional). States: default, hover, focus, filled, disabled, read-only, error. |
| Error | Replaces helper text, red text with an icon, linked to the input for screen readers. Appears on blur and on submit, not while typing. |
| Select | Custom list on desktop with type-to-search when more than 8 options; native select on phones. |
| Date input | Typed entry plus calendar popover, format 17 Nov 2026, Indian Standard Time, past dates blocked where they make no sense. |
| Time input | 15 minute steps, 12-hour with AM or PM. |
| Textarea | Minimum 3 rows, character counter when the backend has a limit. |
| Number and money | Right aligned, tabular numerals, rupee prefix for money, no spinner arrows. |
| Search | Debounced 300 ms, clear button, / key focuses it. |
| Checkbox, radio | Label is clickable; group has a legend. |
| Toggle | Only for settings that take effect immediately. Form choices use checkboxes. |
| Radio cards | Large selectable cards for 2 to 4 important choices, such as service type. |

Form layout: one column, related fields grouped under a section title, actions in a footer that sticks to the bottom of the viewport on long forms.

### 7.3 Status chip

Pill shape, 24 px tall, 12 px medium text, a small dot or icon plus the label, colours from 5.1. Never clickable. One chip style for camps and visits.

### 7.4 Data table

| Aspect | Spec |
| --- | --- |
| Row height | 48 px, with a compact mode of 40 px |
| Header | Sticky, neutral-100 background, label style, sort indicator on sortable columns (set the accessible sort state) |
| Alignment | Text left, numbers right, status chips left |
| First column | The record name, a link to the detail page |
| Row actions | Kebab menu at the right end; at most one inline button |
| Hover | neutral-50 background; no zebra stripes |
| Pagination | Server-side, 20 rows by default (options 20, 50, 100), text like Showing 1 to 20 of 134 |
| Sorting | Single column; each table defines its default sort |
| Loading | Five skeleton rows, not a spinner |
| Empty | Title, one-line hint, a primary action if one exists |
| No results | 'No camps match these filters' with a Clear filters button |
| Error | Message and a Retry button, keep the filters |
| Phone | Stacked cards showing the three most important fields |

### 7.5 Filter bar

Search plus up to four filters, a Clear all button, and applied filters shown as removable chips. State lives in the URL (4.3).

### 7.6 Stat tile

Label, a large number (24 px semibold, tabular), optional hint line. Clickable when it opens a filtered list. Loading shows a skeleton; if the figure cannot be computed, show a dash with a tooltip explaining why. Never show zero as a stand-in for unknown.

### 7.7 Card and panel

White surface, 1 px border, radius 12, padding 16 (24 for large panels). Optional header with a title and one action.

### 7.8 Tabs

Underline style, arrow-key navigation, count shown as small neutral text, active tab stored in the URL.

### 7.9 Modal dialog

| Aspect | Spec |
| --- | --- |
| Width | 480 px small, 640 px medium; full-screen sheet on phones |
| Structure | Title, body, footer with Cancel (secondary) then the primary action, right aligned |
| Behaviour | Focus is trapped; Esc closes unless a save is in progress; initial focus on the first field, or on Cancel for destructive dialogs |
| Destructive pattern | Title states the action; body states the consequence with numbers ('This cancels the camp and 14 resident bookings'); a reason is required if residents are affected; the confirm button repeats the action ('Cancel camp') |
| Typing to confirm | Not used in the MVP. Reserve it for irreversible mass actions, of which there are none yet. |

### 7.10 Side drawer

480 px from the right, used to edit a record without leaving the list (for example a visit). Same footer pattern as a modal. If the form has unsaved changes, closing asks to confirm.

### 7.11 Toast and banner

| Element | Spec |
| --- | --- |
| Toast | Bottom right (top centre on phones), success disappears after 4 s, errors stay until closed, at most three stacked, announced politely or assertively depending on type. No Undo unless the action can really be undone. |
| Banner | Inline at the top of a page or section, four variants with icon, optional action. Used for session expiry, API unavailable, and camp state warnings. |

### 7.12 Overlays and navigation helpers

| Component | Spec |
| --- | --- |
| Dropdown menu | Opens from a button, arrow-key navigation, destructive items last, separated and in danger colour |
| Tooltip | 400 ms delay, supplementary only; essential information never lives only in a tooltip |
| Breadcrumb | Detail pages only, current page not a link |
| Pagination | Previous, next, page numbers with ellipsis, page size select |
| Skeleton | Grey blocks matching the final layout, very subtle shimmer, still when reduced motion is set |
| Avatar | Initials in a coloured circle, 24, 32 or 40 px |

### 7.13 Domain components

| Component | Spec |
| --- | --- |
| Lifecycle stepper | Linear steps for `Open` → `Confirmed` → `In progress` → `Completed`. Past steps filled with a check, current step highlighted, future steps muted. If `Cancelled`, remaining steps collapse into a single red terminal step displaying the cancellation reason. |
| Tier progress | Progress bar of participants against the next discount threshold, with text such as '9 of 10 joined, 1 more unlocks 15% off'. Highlights the current discount tier and shows exact rupee savings. |
| Activity milestone tracker | Vertical milestone list derived from entity timestamps: Camp created (who/when), Vendor assigned (who/when), Confirmed & slots scheduled, Visits commenced, and Completed (or Cancelled with reason). |
| Copy field | Read-only mono text with a Copy button that changes to Copied for 2 seconds. |
| Photo comparison | Before and after photos side by side with timestamps, click to enlarge, a clear placeholder when a photo is missing. |
| Impact summary | A small panel listing what an action will change (counts, names) before the confirm button. Used in every resident-affecting confirmation. |

## 8. Screen specifications (MVP)

Each screen lists purpose, layout, content, actions and states. Every list screen also needs the loading, empty, no-results and error states from 7.4, so they are not repeated.

### 8.1 Sign-in and landing

Ops uses the same Login screen as residents and vendors. After login the app calls the current-user endpoint and, for the ops role, redirects to /ops. A non-ops user who opens an /ops address is redirected to their own home. Session expiry follows the same pattern as the auth guide: clear the session, return to Login with 'Your session expired. Please log in again.'

### 8.2 Dashboard

**Purpose:** answer 'what needs me right now?' in five seconds.

**Layout, top to bottom:**

1. Page title 'Dashboard', a Refresh button and the text 'Updated 10:42 AM'.
2. Four stat tiles: Open camps, Camps without a vendor, Visits today, Visits this week.
3. Two panels side by side (stacked on small screens): **Needs attention** (left) and **Today's visits** (right).
4. **Upcoming camps**: compact table of the next five camps with a View all link.

**Needs attention** lists items with a reason and a direct action, for example 'AC servicing day, Greenfield Residency: no vendor, camp in 3 days. Assign vendor'. Rules that qualify an item: a camp with no vendor and a date within 7 days; a visit with no vendor. Do not invent other rules until the backend can support them. If the list is empty, show a positive message: 'Nothing needs your attention.'

**Today's visits** shows time, society, service, vendor and status chip, each row linking to the visit.

**Data (VERIFY):** if your backend has no summary endpoint, compute tiles from the list endpoints or defer the tiles that need aggregation. A tile with no data source shows a dash, not zero.

### 8.3 Camps list

**Header:** 'Camps' with the primary button Create camp.

**Segment tabs:** Active (Draft, Open, Closed, Scheduled, In progress), Completed, Cancelled, All. Default is Active.

**Filters:** search (camp name or society), service type, society, date range. Status filter appears only on the All tab.

| Column | Content | Hidden first on narrow screens |
| --- | --- | --- |
| Camp | Title and service type, link to detail | No |
| Society | Name | No |
| Date | 17 Nov 2026 | No |
| Status | Chip | No |
| Vendor | Name, or 'Unassigned' in warning colour | Yes (4th) |
| Participants | Number joined | Yes (3rd) |
| Discount | Current tier, for example 10% off | Yes (2nd) |
| Actions | Kebab: View, Edit, Cancel, depending on state (Section 10) | No |

Default sort: date, soonest first. Empty state: 'No camps yet. Create the first camp for a society.' with the Create camp button.

### 8.4 Create and edit camp

A full page, not a modal, because the form is comprehensive. Single column, 640 px wide, sections as cards.

| Section | Fields | Rules |
| --- | --- | --- |
| Basics | Service catalog (e.g. Pest control, AC service), Society (select dropdown), Camp title | All required. Title 1 to 200 characters. |
| Schedule & Capacity | Starts at, Ends at, Slot duration (20, 30, 45, 60 min), Min participants, Max participants, Join deadline | Slot capacity auto-calculated: $(\text{ends} - \text{starts}) // \text{slot\_minutes}$. Max participants cannot exceed slot capacity. Min participants $\ge 1$. Join deadline strictly $\ge 24$ hours before window start. |
| Pricing | Base price in rupees (stored as integer paise), discount tiers table | Tiers: minimum participants and discount percent per row, add and remove rows. Headcounts strictly increase, discounts strictly increase, no duplicates, max tier threshold cannot exceed max participants. |
| Vendor | Active vendor select, optional at creation | Lists verified active vendors. One vendor per camp. Can be assigned at launch or later prior to confirmation. |
| Rules (read-only) | 'Residents can cancel up to 24 hours before the service date.' | Display only, strictly enforced by domain rules. |

**Footer (sticky):** Cancel (secondary), Launch Camp (primary; publishes the camp immediately as `Open` to the society's residents).

**Validation:** live client-side capacity and tier monotonicity feedback; atomic backend validation in `camp_rules.py` and `pricing.py`. A failed save preserves all input values and displays clear inline error alerts.

### 8.5 Camp detail

**Header:** title, status chip, society and date; primary action depends on state (Section 10); a kebab menu holds the rest.

**Below the header:** the lifecycle stepper (7.13).

**Tabs:**

| Tab | Content |
| --- | --- |
| Overview | Summary card (service, society, date, vendor, base price), tier table with the tier progress bar, notes |
| Participants | Table: resident name, unit if available, joined date, status. Phone numbers are not shown in the list. Export is deferred. |
| Visits | Table of visits with time, resident, vendor, status; Edit visit opens the drawer from 8.6 |
| Activity | Timeline of changes with who and why |

**Side card:** key facts, vendor with a Change vendor button, participant count, next deadline.

### 8.6 Visits list, reschedule and reassign

**Visits page:** filters for date range (default today to 7 days ahead), vendor, society, status, service. Columns: Time, Resident and unit, Society, Service, Vendor, Status, Actions. Default sort: time, soonest first.

**Edit visit drawer:**

| Field | Rule |
| --- | --- |
| Visit time | Date and time, limited to the camp day |
| Vendor | Select from vendors who offer the service |
| Reason | Required select (Resident request, Vendor unavailable, Scheduling conflict, Other) plus an optional note; the note becomes required for Other |

Below the fields an **impact summary** shows the change, for example 'Time: 10:30 AM to 2:00 PM. Vendor: A to B.' Saving opens a short confirmation.

**Important and honest:** notifications are deferred, so residents are not told automatically. The confirmation must say so: 'The resident will not be notified automatically. Please contact them.' If you build notifications later, replace this text.

**Conflicts:** if the vendor already has an overlapping visit, show a warning banner in the drawer. Whether saving is blocked is decided by the backend (VERIFY); the UI shows the server's message either way.

The UI waits for the server before updating the row; no optimistic updates for changes that affect residents.

### 8.7 Vendors (read-only)

List columns: Name, Services, Active camps, Visits this week, Status. Detail page: profile, assigned camps, upcoming visits. No create, edit or approval actions in the MVP because vendors are seeded. A vendor approval queue is Deferred; the sidebar does not show a placeholder for it.

### 8.8 Societies and invite codes

List columns: Society, Residents, Camps, Invite code (copy field). Detail: basic info, invite code with Copy, and Regenerate code. Regenerate is destructive: the confirmation says 'The current code stops working immediately. Residents who already registered are not affected.' and the button is 'Regenerate code'. Both the copy field and Regenerate depend on your backend (VERIFY); hide Regenerate entirely if it does not exist.

### 8.9 Users lookup

**Purpose:** find a person quickly to help them.

**Layout:** a prominent search box (name, username or phone), then a table: name, username, role, society, joined date. Selecting a row opens a read-only drawer with profile, society, camps joined and visits.

**Privacy:** phone numbers are partly masked in the list and shown in full only in the drawer.

**Sign-in help:** reset password and verify phone are Deferred because OTP and reset do not exist. Until they do, the drawer shows a note for ops: 'Password reset is not available yet. Ask a developer to reset this account.' Do not draw buttons for features that do not exist.

### 8.10 Job evidence (conditional)

If photos are part of your visit model: the visit detail shows the photo comparison component (7.13). A completed visit with a missing photo shows a warning banner: 'Completed without an after photo.' If photos are not in the MVP, skip this screen.

### 8.11 System pages

| Page | Content |
| --- | --- |
| Not found | 'This page does not exist.' with a link to the dashboard |
| Forbidden | 'You do not have access to this page.' with a link to your home |
| Server error | 'Something went wrong on our side.' with Retry and a link to the dashboard |
| Offline or API down | Banner at the top of the page, the last loaded data stays visible |

## 9. Key flows

### 9.1 Create and launch a camp

1. Navigate to Camps, then click **+ Create Camp**.
2. Select target Society and Service catalog; specify Camp Title.
3. Configure Schedule & Capacity: Starts At, Ends At, Slot Duration, Min/Max participants, and Join Deadline (≥ 24h before start). Live counter validates window capacity slots.
4. Set Base Price and configure dynamic Volume Discount Tiers (previewing price at each tier).
5. Optionally select an active Vendor now, or leave unassigned.
6. Click **Launch Camp**. Atomic backend validation runs; camp immediately transitions to `Open` for that society's residents. User is redirected to Camp Detail view.

### 9.2 Assign or change a vendor

1. Camp detail, then Change vendor (or Assign vendor when none).
2. A dialog lists eligible vendors with their load that day.
3. The impact summary shows how many visits move.
4. Reason is required when the camp already has visits or participants.
5. After success, the Activity timeline gains an entry and the visits list shows the new vendor.

### 9.3 Reschedule a single visit

Visits page or camp Visits tab, Edit visit, drawer from 8.6, impact summary, confirmation with the no-notification warning, success toast.

### 9.4 Cancel a camp

1. Kebab, then Cancel camp (only where Section 10 allows it).
2. The dialog shows the impact: 'This cancels the camp and 14 resident bookings.'
3. Reason is required.
4. The confirm button is labelled Cancel camp and uses the destructive style; the safe default focus is on the dismiss button.
5. After success the camp shows Cancelled and becomes read-only. The Activity tab records who and why.

### 9.5 Help a resident who cannot sign in

Users, search, open the drawer, confirm identity (username, society), then follow the Deferred note in 8.9. This flow is intentionally short in the MVP.

### 9.6 Morning check

Dashboard, scan the four tiles, work the Needs attention list top to bottom, then open Today's visits. This is the flow the dashboard layout is optimised for.

## 10. State and action matrix

Confirmed against Domora's database check constraints (`camp_status_check` and `booking_status_check`) and Phase 4 service rules.

| Camp state | Edit details | Change vendor | Reschedule / Sequence visits | Cancel camp | Primary action |
| --- | --- | --- | --- | --- | --- |
| **Open** | Limited (title, timings if no bookings) | Yes (`PATCH /ops/camps/:id/vendor`) | Not applicable (no slots assigned yet) | Yes, with required reason | **Confirm Camp** (active when headcount ≥ min_participants and vendor assigned; locks price and sequences slots) |
| **Confirmed** | No (price and slots locked) | Yes, with warning dialog | Sequenced consecutively in join order; manual slot adjustments deferred in MVP | Yes, with required reason (cancels all active bookings) | None (awaits vendor start) |
| **In progress** | No | No (vendor is on site performing jobs) | Read-only job status & before-photos | Emergency cancellation only (with required audit reason) | Monitor live visits & before/after photos |
| **Completed** | No | No | No | No | None (read-only archive; inspect job records and photo proof) |
| **Cancelled** | No | No | No | No | None (read-only archive; displays cancellation reason) |

When an action is not available, show it disabled with a tooltip explaining why (e.g. *'Cannot confirm: minimum 3 participants required and vendor must be assigned'*), unless it is irrelevant to the state, in which case hide it.

## 11. Content and microcopy

### 11.1 Voice

Plain, direct, calm. Say what happened and what to do next. No jargon, no blame, no exclamation marks, no humour in errors.

### 11.2 Terminology (use these words everywhere)

| Use | Do not use | Meaning |
| --- | --- | --- |
| Camp | Event, drive | A service day organised for a society |
| Visit | Booking, job, appointment | One technician visit to one resident's home |
| Vendor | Technician, partner | The service provider assigned to a camp |
| Resident | Customer, user (in resident contexts) | A person who joins camps |
| Society | Community, building | The apartment building or gated community |
| Participants | Members | Residents who joined a camp |

Use 'user' only on the Users screen where roles are mixed. Keep the same term in navigation, headings, buttons and messages.

### 11.3 Formats

| Item | Format |
| --- | --- |
| Date | 17 Nov 2026 (never 11/17/26, which is ambiguous in India) |
| Time | 10:30 AM, Indian Standard Time, shown only once per screen if all times share the zone |
| Money | Rupee sign with Indian digit grouping, for example 1,25,000 |
| Percent | 15% off |
| Counts | 14 visits, 1 visit (handle singular) |
| Relative dates | 'In 3 days' next to the absolute date, never instead of it |

### 11.4 Message patterns

| Type | Pattern | Example |
| --- | --- | --- |
| Field error | What is wrong, what to do | 'Enter a date that is today or later.' |
| Form error | Count and point to the first | 'Fix 2 fields to continue.' |
| Server failure | Plain cause, next step | 'We could not save the camp. Check your connection and try again.' |
| Success toast | Past tense, names the thing | 'Camp published.' |
| Confirmation title | The action as a question | 'Cancel this camp?' |
| Empty state | What belongs here, how to add it | 'No visits today. Visits appear here once a camp is scheduled.' |
| Disabled tooltip | Why, not what | 'Cancel is unavailable once visits are in progress.' |

Never show raw status codes, stack traces or database messages to ops.

## 12. Feedback and state patterns

| Situation | Pattern |
| --- | --- |
| Page loading | Skeletons shaped like the final content; no full-page spinner |
| Action in progress | Button loading state; the rest of the form stays visible but inactive |
| Success | Toast, plus the data on screen visibly updates |
| Recoverable error | Inline message at the cause, form values kept |
| Page-level failure | Error state with Retry, filters and position kept |
| Slow request (over 3 s) | Add the text 'Still working...' near the spinner |
| Session expired | Redirect to Login with the expiry message; after login return to the page they were on (Recommendation) |
| Concurrent edit | If the server reports a newer version, show 'This was changed by someone else. Reload to see the latest.' and do not overwrite silently |
| Unsaved changes | Browser and in-app guard when leaving a dirty form or drawer |

## 13. Accessibility

**Target:** WCAG 2.2 level AA. Confidence that the spec as written meets it: medium; it must be tested, not assumed.

| Area | Requirement |
| --- | --- |
| Contrast | Text 4.5:1, large text and icons 3:1, focus ring 3:1 against its background |
| Keyboard | Every action reachable by keyboard in a logical order; no keyboard traps; skip-to-content link at the top |
| Focus | Always visible (2 px outline); after opening a modal focus moves into it, after closing it returns to the trigger; after a route change focus moves to the page title |
| Labels | Every input has a visible label; icon buttons have accessible names |
| Errors | Linked to their fields, announced when they appear; the first error receives focus on submit |
| Tables | Real table markup, header cells scoped, sort state exposed, no layout tables |
| Colour | Never the only carrier of meaning (status chips carry text) |
| Targets | At least 24 by 24 px on desktop (WCAG 2.2), 44 by 44 px on touch |
| Motion | Reduced-motion preference removes slides and shimmer |
| Language | Page language declared; dates and numbers formatted for the user's locale |
| Zoom | Usable at 200% zoom with no horizontal scrolling of the page body |

Test with keyboard only, a screen reader on at least one real flow (create a camp), and a contrast checker.

## 14. Security and privacy in the interface

The interface is not a security boundary; the backend is. These rules reduce mistakes and exposure.

- Route guard for the ops role on every /ops route; hide actions the state matrix forbids, and rely on the backend to enforce them.
- Show personal data on a need-to-see basis: phone numbers masked in lists, shown in full only in a detail drawer.
- No personal data in URLs, page titles or toast text that could be screenshotted widely.
- Every change affecting residents asks for a reason and appears in the Activity timeline with the actor's name and time. (Whether the backend stores an audit trail is a VERIFY item; without it the timeline cannot be truthful.)
- Session length follows the backend token (24 hours by default). Do not extend it silently on the client.
- Log out clears all stored data, including cached lists.
- Do not render user-supplied text as HTML.

## 15. Implementation approach

These are *Recommendations* for your React and Vite stack, not requirements.

| Concern | Suggestion | Why |
| --- | --- | --- |
| Styling | CSS variables for tokens, plus either Tailwind or plain CSS modules | Variables carry the design tokens; either styling method works |
| Accessible primitives | Radix UI primitives or the shadcn/ui pattern for dialog, dropdown, tabs, tooltip, select | Focus trapping and keyboard behaviour are easy to get wrong when hand-built |
| Tables | TanStack Table for sorting, columns and pagination state | Keeps table logic out of components |
| Server data | TanStack Query for fetching, caching, retry and refetch | Gives loading, error and refresh states for free |
| Forms | React Hook Form with Zod schemas | Field-level validation and error mapping |
| Dates | date-fns, with explicit Asia/Kolkata handling | Avoids timezone surprises |
| Icons | Lucide React | Matches 5.8 |

**Trade-off to weigh honestly:** using these libraries is faster and safer, but you will be asked in interviews to explain what they do. Building two components yourself (for example the status chip and the data table) shows understanding without costing weeks. Decide where you want to learn and where you want to ship.

**Folder structure (responsibilities only):** a shared components folder for the design system pieces in Section 7, a pages folder per ops screen, a feature folder per area (camps, visits, vendors, societies, users) holding its API calls, types and hooks, and one tokens file. Pages never call fetch directly; they use the API client from the auth guide.

## 16. Build order and checkpoints

Build the foundation before any screen, and verify each step on a real laptop and a phone.

| Step | Build | Checkpoint |
| --- | --- | --- |
| 1 | Tokens, global styles, typography, icon set | A kitchen-sink page showing colours, text styles and spacing; check contrast |
| 2 | Shell: sidebar, top bar, responsive behaviour, route guard for ops | Resize from 1440 px down to 360 px; non-ops user is redirected away |
| 3 | Core components: button, inputs, status chip, card, banner, skeleton | Every component in every state on one page; keyboard-only pass |
| 4 | Data table, filter bar, pagination, empty, error states | A table with fake data showing all seven states in 7.4 |
| 5 | Overlays: modal, drawer, toast, dropdown, tooltip | Focus trapping and return-focus work; Esc behaviour matches the spec |
| 6 | Camps list and Camp detail (read-only) against the real API | Real data, URL-synced filters, status chips from one map |
| 7 | Create and edit camp | All validation cases; server error mapped to fields |
| 8 | Vendor assignment and the cancel flow with impact summary | Counts in the dialog match the data; Activity entry appears |
| 9 | Visits page and edit drawer | Reschedule and reassign work; no-notification warning shown |
| 10 | Dashboard | Each tile traces to a real data source or shows a dash |
| 11 | Vendors, Societies, Users (read-only) | Search, masking, copy field |
| 12 | Polish, accessibility pass, usability test, fixes | Section 18 complete |

Do the dashboard late (step 10) even though it appears first: it depends on data from every other area, and designing it last means its numbers are real.

## 17. Deferred items and known limitations

Put these in your README so they read as conscious scope decisions.

- No notifications: ops must contact residents manually after a change (the UI says so).
- No password reset, OTP or phone verification actions in the Users screen.
- No vendor approval queue; vendors are seeded.
- No bulk actions, exports, reports or analytics.
- No dark mode, no offline support, no PWA install for the ops portal.
- Single ops role with full permissions; no audit-based permission model.
- Concurrent edits are detected only if the backend supports versioning (VERIFY).

## 18. QA checklist and usability test

### 18.1 Definition of done

- Every screen in Section 8 implemented with its loading, empty, error and no-results states.
- Status chips and colours come from one map and match 5.1.
- Every resident-affecting action shows an impact summary and, where specified, requires a reason.
- The action matrix in Section 10 matches the backend rules.
- Responsive at 1440, 1024, 768 and 360 px.
- Keyboard-only completion of: create camp, assign vendor, reschedule visit, cancel camp.
- No console errors; no raw error text shown to users.
- README documents deferred items (Section 17).

### 18.2 Usability test script

Run with three to five people who have not seen the portal, ideally someone who does operations-like work. Give tasks, not instructions, and note where they hesitate. Do not help unless they are stuck for over a minute.

| Task | Success looks like |
| --- | --- |
| Create and publish a camp for a society | Under 3 minutes, no help |
| A vendor cancelled: replace them for tomorrow's camp | Finds Change vendor, reads the impact summary, under 1 minute |
| A resident asks to move their visit to the afternoon | Uses the Visits page or camp tab, notices the no-notification warning |
| Find a user who cannot sign in | Under 30 seconds |
| Cancel a camp | Reads the consequence, gives a reason, does not cancel the wrong camp |

Record time, errors, hesitations and quotes. Fix the top three problems, then repeat with a new person. With five or fewer participants this gives directional evidence only, not proof.

## 19. Open questions and risks

### 19.1 Open questions (Answered & Validated against Domora Backend)

1. **What exact camp states and transitions does your state machine define?**
   - **Resolved**: 5 states: `open`, `confirmed`, `in_progress`, `completed`, `cancelled` (enforced by DB check constraint `camp_status_check`). No `Draft` or `Closed` states; confirming locks price and sequences slots; bookings move in lockstep: `joined` → `scheduled` → `in_progress` → `completed` (or `cancelled`).
2. **Which ops endpoints exist: camp CRUD, vendor assignment, visit update, user search, society and invite code management?**
   - **Resolved**: Sub-phase 4a provides `POST /ops/camps`, `GET /ops/camps`, `GET /ops/camps/:id`, `PATCH /ops/camps/:id/vendor`, `/ops/societies`, `/ops/services`, `/ops/vendors`. Phase 4d adds `POST /ops/camps/:id/confirm` and `POST /ops/camps/:id/cancel`. Manual arbitrary slot swapping is deferred in MVP.
3. **Does the backend store an audit trail of changes with actor, time and reason?**
   - **Resolved**: Stored on domain entities (`created_at`, `created_by`, `cancelled_reason`, booking timestamps, job record timestamps). No generic audit log table; timelines derive from entity milestones.
4. **Is there a minimum participant rule for a camp to go ahead, or only discount tiers?**
   - **Resolved**: Yes, strictly enforced. `min_participants >= 1`; camp confirmation is blocked if active headcount < `min_participants` or if no vendor is assigned (Rule 5).
5. **What are the real validation limits (title length, tier limits, password rules)?**
   - **Resolved**: Title: 1–200 chars. Window: `starts_at < ends_at`. Slots: `duration // slot_minutes`. Capacity: `max_participants <= capacity_slots`. Deadline: strictly ≥ 24h before start. Tiers: strictly increasing min participants and non-decreasing discounts. Password: 8–128 chars.
6. **Are visit photos part of the MVP?**
   - **Resolved**: Yes (Phase 5). `job_records` requires `before_photo_path` to start and complete, and prevents an after-photo without a before-photo.
7. **Will ops use phones heavily, or is a laptop the primary device?**
   - **Resolved**: Laptop / Desktop (1280px–1440px) is the primary device for Ops. Resident and vendor views are phone-first (360px–420px).

### 19.2 Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Scope: a full ops portal is large for a portfolio project | High | High | Build in the Section 16 order; cut from the end (Users, Societies) before cutting quality of the camp flows |
| Design assumes backend features that do not exist | Medium | Medium | Answer open questions 2 and 3 before steps 8 and 9 |
| Dashboard numbers need aggregates the API lacks | Medium | Low | Show dashes or defer tiles |
| Accessibility claims untested | Medium | Medium | Do the keyboard and contrast passes in steps 3 and 12 |
| Over-investing in polish over working flows | Medium | Medium | Finish the flows with the plain components first, polish last |

**An honest caution:** this specification is larger than what one person can finish quickly. If time is tight, the camp list, camp create and detail, vendor assignment and the visit reschedule flow are the heart of the portal; the dashboard, vendors, societies and users screens are valuable but optional for a convincing demo.
