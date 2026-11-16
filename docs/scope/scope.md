# Scope: Domora

Domora helps residents in a housing society coordinate group bookings for home services. Vendors and society ops manage their work through the app.

**Build approach:** Tracer Bullet (prove the login path through the backend and browser first).
**Workflow:** Beta (verify and test after build).

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Browser authentication | Phase 6a | in-progress |

## Phase 6: Frontend

### 1. Browser authentication · in-progress

Build login and resident signup for the browser, then open a placeholder home page based on the user's role.
**Done when:** residents can sign up and log in, all three roles reach the right page, and cookie sessions restore and clear safely.
* [x] Design it (spec): `/architect browser authentication`
* [ ] Build it: `/develop browser authentication`
  * [ ] Cookie API and first browser login (AC-1, AC-4, AC-8)
  * [ ] Session restore, logout, role routes, and placeholder pages (AC-5, AC-6, AC-7)
  * [ ] Signup, automatic login, and error handling (AC-2, AC-3)
  * [ ] Accessible screens, responsive layout, and route refresh (AC-2, AC-7, AC-9, AC-10)
* [ ] Verify it: `/check verify browser authentication`
* [ ] Test it: `/test browser authentication`
Spec [0001](../specs/0001-browser-authentication.md)

## Deferred

* Confirm no outside client needs the current bearer token response before production.
* Choose the production frontend and API hosts, configure exact CORS origins, and set up frontend route fallback.
* Revisit rate limiting and account lockout before public launch.

## Legend

Every feature has one design box ending in `(spec)`. After design, build milestones stay coarse here, and implementation details stay in the linked spec. The feature moves from planned to in-progress to done as work is built and checked.
