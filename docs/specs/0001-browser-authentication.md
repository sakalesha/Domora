# 0001. Browser authentication

**Date**: 2026-11-16
**Status**: In Progress

## Summary

This feature adds login and resident signup screens to the React app. It uses a protected browser cookie for the existing JWT session, rather than exposing the token to JavaScript. The work also adds role based pages and the backend protections needed for cookie authentication.

## Context

The backend already supports resident signup, username and password login, and a profile endpoint. Login currently returns a bearer token in JSON, and protected requests require that token in an Authorization header. There is no frontend source tree, CORS configuration, or cookie authentication yet.

> Premise note: The project already uses custom JWT authentication instead of a managed identity service. Cookie authentication adds more security work, including CSRF checks and origin controls. Keep the change limited to the current username and password flow, and do not add refresh tokens, token revocation, OAuth, or phone verification.

The [frontend auth implementation guide](../frontend-auth-implementation-guide.md) defines the screens and user flows. The backend requires full name, username, password, phone, unit label, and invite code for signup. It does not impose a username character rule. Vendor and ops accounts are seeded, and those users have no assigned society. Hosting providers are not selected, so production frontend and API origins must be configured before release.

## Requirements

**User stories**:
* As a resident, I want to sign up and then be logged in so that I can enter my society's app.
* As a resident, vendor, or ops user, I want to log in and see the right home page so that I can use the app for my role.

**Acceptance criteria**:
* **AC-1**: A successful login sets an HttpOnly access cookie, loads the current profile, and opens the home page for the user's role. The login response does not expose the access token in JSON.
* **AC-2**: Wrong or unknown login credentials show the same generic message. Network, server, and form validation failures show useful text without raw status codes, and failed forms keep their entered values.
* **AC-3**: Resident signup validates and submits full name, username, password, phone, unit label, and invite code. On success it logs the resident in automatically. If the follow up login fails, it opens Login with the username filled in and an account created message.
* **AC-4**: A session lasts exactly 24 hours, using `ACCESS_TOKEN_EXPIRE_MINUTES=1440`. The login response reports `expires_in` in seconds, and the JWT and access cookie use the same lifetime. The access cookie is host only, HttpOnly, SameSite=Lax, and Secure outside local development and tests. The browser never stores or reads the access token in localStorage or sessionStorage.
* **AC-5**: On app load, a loading screen remains until the current profile request finishes. A failed profile request makes the UI anonymous and attempts to clear the server cookie. An unreachable server may prevent cookie deletion, but the UI does not treat the user as authenticated.
* **AC-6**: Logout clears in memory auth state immediately and opens Login. It uses the current CSRF token for the logout request, then discards it from auth state and fetches a fresh one before enabling unsafe forms. If no token is available, fetch one before logout. If a request fails, Login shows a retry message and the cookie may restore the session after reload. A 401 from an authenticated request clears the session and opens Login with a session expired message. A resident, vendor, or ops user is redirected to their own placeholder page and cannot remain on another role's page. An unknown role is denied a role page.
* **AC-7**: Each role page shows the user's full name, role, and society name when the profile has a society. It omits the society line when the API returns `society: null`.
* **AC-8**: Cookie requests use credentialed CORS with an exact origin allowlist. Preflight allows `GET`, `POST`, and `OPTIONS`, and the `Content-Type` and `X-CSRF-Token` headers. Unsafe requests require a valid CSRF token and an allowed Origin.
* **AC-9**: The screens follow the guide at 360 by 800 px and 1280 by 800 px. Inputs and buttons are at least 48 px high, labels and errors are accessible, focus is visible, and the password can be shown or hidden.
* **AC-10**: Direct navigation and refresh work for every frontend route in development and preview. Production hosting must serve the app entry point for these routes before release.

## Options considered

### Option 1: Keep bearer tokens in browser storage

Keep the current login response and store its token in localStorage for requests.

**Pros**:
* Matches the current backend contract with the fewest backend changes.
* Works for a frontend and API hosted on unrelated sites.

**Cons**:
* Any script running in the app can read and steal the token.

### Option 2: Add a second cookie authentication API

Keep the current bearer API and add separate cookie login and logout endpoints for the browser.

**Pros**:
* Existing bearer clients can continue using their current contract.
* The browser does not need to receive its access token.

**Cons**:
* The backend would maintain two login and session paths.
* Both paths would need ongoing tests and documentation.

### Option 3: Replace the browser bearer contract with cookie authentication

Change the existing login and current user flow to use an HttpOnly cookie. Add CSRF protection, credentialed CORS, and logout support.

**Pros**:
* The browser cannot read the access token.
* The app has one session flow to implement and test.

**Cons**:
* Any external clients that depend on the current bearer response must change.
* Cookie authentication requires CSRF protection, exact origin configuration, and same site production hosting.

## Decision

**Chosen option**: Option 3, replace the browser bearer contract with cookie authentication.

Use the existing JWT backend with an HttpOnly cookie for browser sessions. Use TypeScript with React and Vite, React Router, and Tailwind CSS. Use a same site production deployment for the frontend and API.

## Rationale

The user selected HttpOnly cookies, automatic login after signup, the supplied guide, TypeScript, and same site production origins. TypeScript lets the new frontend check profile roles and session states during the build. The frontend has not been scaffolded, and the current backend is still in development. A direct change avoids maintaining two authentication flows for a feature that has no frontend consumer yet.

The alternative is to preserve bearer compatibility with separate cookie endpoints. That is safer if external clients already exist, but adds a second contract and more tests. Before production, confirm there are no external clients that still depend on the bearer response. If there are, use the separate endpoint approach instead.

## Feature design

**Build approach**: Tracer Bullet. No project build approach is recorded. Start with one working login path through the backend and browser, then add signup, role routing, and visual polish.

**Data model sketch**:
* No database changes.
* Keep the existing User and Society records and relationships.
* Keep the access token stateless. The backend issues it for 24 hours and stores it in the access cookie.
* Keep the CSRF token in a signed double submit cookie and in frontend memory. Do not persist it in localStorage.

**State transitions**:
* App state starts as loading. A valid profile response changes it to authenticated. Any profile failure changes it to anonymous and attempts logout.
* Login and signup forms move from idle to loading, then to authenticated or an error state.
* A successful signup calls login with the submitted credentials. If that login fails, show the account created message and return to Login.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/csrf` | GET | None | Signed CSRF token, CSRF cookie | Public, allowed Origin | 403 disallowed Origin, 500 |
| `/auth/signup` | POST | `full_name`, `username`, `password`, `phone`, `unit_label`, `invite_code` | Safe user summary | Public, CSRF token and allowed Origin | 409 duplicate username or phone, 422 invalid fields or invite code |
| `/auth/login` | POST | `username`, `password` | `expires_in` in seconds; sets access cookie | Public, CSRF token and allowed Origin | 401 generic invalid credentials, 422 invalid fields |
| `/auth/me` | GET | None | Safe profile and optional society | Access cookie | 401 missing, invalid, or expired cookie |
| `/auth/logout` | POST | None | 204; clears access and CSRF cookies | CSRF token and allowed Origin | 403 invalid CSRF token or Origin |

The profile response contains string values for `id`, `username`, `full_name`, and `phone`; `role` is `resident`, `vendor`, or `ops`; `society_id` and `unit_label` are strings or null; `phone_verified` is false; and `society` is either null or an object with string `id`, `name`, and `city` values. Unknown roles fail closed, clear the session when possible, and show a generic error.

The access cookie is named `domora_access`. It is HttpOnly, host only, SameSite=Lax, Path `/`, and has a Max-Age matching `expires_in`. `ACCESS_TOKEN_EXPIRE_MINUTES` must be 1440. The token expiration and cookie Max-Age use this same value, converted to seconds for `expires_in`. Secure is enabled outside environments named `development` or `test` in `APP_ENV`. Do not return the JWT in JSON or attach it to an Authorization header from the browser. The browser protected endpoints use cookie authentication.

The CSRF cookie is named `domora_csrf`. `GET /auth/csrf` requires an allowed Origin and returns the current valid signed random value, or creates one with a 24 hour expiry if none exists. It sets the value in a host only, HttpOnly, SameSite=Lax cookie and returns it in JSON. Secure follows the access cookie rule, and Path is `/`. The frontend gets the value at app startup, keeps it in memory, and sends it in the `X-CSRF-Token` header. Tabs share the same cookie value. If concurrent first requests create different values, a stale value is rejected; the frontend fetches a fresh token and asks the user to submit again. Sign the random nonce and expiry with HMAC-SHA256 using `SECRET_KEY` and a CSRF specific purpose. The backend checks the header, cookie, signature, expiry, and exact Origin for every unsafe request, using a constant time comparison for token checks. Reject missing and non allowed Origin values. CORS permits credentials only for exact configured origins, never `*`, and allows only `GET`, `POST`, and `OPTIONS` with `Content-Type` and `X-CSRF-Token` headers.

The frontend API client uses `credentials: "include"` for API requests. The local API URL is `http://localhost:8000`, and the local Vite origin is `http://localhost:5173`. Production frontend and API hosts must share the same registrable domain. Production configuration must fail closed if `CORS_ALLOWED_ORIGINS` is empty or contains `*`. The exact production frontend origin is a release requirement and remains unset until hosting is selected.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Login | Session lifetime | `expires_in` in seconds, derived from `ACCESS_TOKEN_EXPIRE_MINUTES=1440` |
| Login and session restore | User name, role, society, and route | `GET /auth/me`; route is derived from the returned role |
| Signup | Full name, username, password, phone, unit label, and invite code | Signup form values, validated against `SignupRequest` |
| Signup fallback | Prefilled username and account created message | Submitted username and signup success followed by login failure |
| Role home | Display name and role | `full_name` and `role` from `GET /auth/me` |
| Role home | Society name or no society line | `society.name` when present; omit when `society` is null |
| Form errors | Field or banner text | Normalized API response, or a network error when there is no response |

**Screen and interaction design**:
* Use React Router with `BrowserRouter`. The root route opens Login for anonymous users and sends authenticated users to the home page for their role. Use `/login`, `/signup`, `/resident`, `/vendor`, and `/ops`. Authenticated users visiting Login or Signup go to their role home. Visiting another role's route also redirects to the user's own home. An unexpected role has no route and fails closed.
* Login shows the Domora text wordmark, the heading `Welcome back`, username, password with a show or hide control, the Login button, and a link to signup.
* Signup shows the full name, username, password, phone, unit label, and invite code fields in that order. Include a link back to Login.
* Each placeholder page shows `Hi, {full_name}`, the role label, the society name when present, and a Logout button. It has no other dashboard content.
* Use a centered card with a maximum width of 420 px. Use a system font, 8 px spacing increments, and a calm teal accent of `#0f766e` with a near white background of `#f8faf9`.
* Inputs and buttons are 48 px high, with input text at least 16 px. Every field has a visible label, and each field error is associated with its input. Keep visible focus outlines and use the username, current password, new password, and telephone autocomplete values where appropriate.
* Show `Incorrect username or password.` for login failure. Show `Can't reach the server. Check your connection and try again.` when there is no server response. Show `Something went wrong. Please try again.` for an unmapped server failure. A 401 from an authenticated request shows `Your session expired. Please log in again.`
* Map duplicate signup responses to `That username or phone number is already in use.`, because the backend does not identify which value conflicted. Map invalid invite code to `That invite code isn't valid. Check with your society committee.` Map FastAPI field errors by the final field name in `detail`. The password helper says `At least 8 characters.` Do not show a username character rule.
* If signup succeeds but login fails, show `Account created, please log in.` and prefill the username.
* For required or length validation errors, use `This field is required.` for blank values and safe field messages: name must be 150 characters or fewer, username 80 or fewer, password 8 to 128, phone 30 or fewer, unit label 50 or fewer, and invite code 50 or fewer. Do not show raw FastAPI validation text or status codes. Phone validation checks only the backend's trimmed, nonempty, maximum length rule. Do not add a phone format rule.
* A CSRF or Origin rejection shows `Request could not be completed. Refresh and try again.` Do not automatically retry an unsafe request.
* If CSRF token loading fails, keep unsafe form submission disabled and show the network error with a retry action.

**Key invariants**:
* Public signup always creates a resident. It never accepts a role from the browser.
* The backend signup schema is the source of truth. Username is trimmed and 1 to 80 characters, full name is trimmed and 1 to 150 characters, phone is trimmed and 1 to 30 characters, unit label is trimmed and 1 to 50 characters, and invite code is trimmed and 1 to 50 characters. Do not impose a phone format or username character restriction.
* Password length is 8 to 128 characters. Do not trim the password.
* Normalize the invite code by trimming and uppercasing it before submission.
* A role guard improves navigation only. Backend role checks remain the security boundary.
* On any `/auth/me` failure, set the frontend state to anonymous and attempt `/auth/logout`. When the server is unreachable, the HttpOnly cookie cannot be deleted by JavaScript and expires naturally after 24 hours.
* Logout clears in memory auth state immediately, uses the current CSRF token for its request, discards that token from auth state, and fetches a fresh token before enabling login or signup. If no token is available, fetch one before logout. If the logout or token request fails, show a retry message. The cookie may restore the session after a reload until the server clears it or it expires.
* If the server rejects an expired or mismatched CSRF token, fetch a new token and let the user submit again. Do not automatically retry an unsafe request.

**Security model**:
* Login, signup, and profile access use the existing username and password identity and JWT signing key. Cookie authentication replaces the existing bearer contract for browser protected requests.
* The browser access token is held only in an HttpOnly cookie. Do not expose it in JSON, browser storage, logs, or UI state.
* Cookie authenticated unsafe requests require the signed CSRF token and an exact allowed Origin.
* CORS uses an explicit origin list and credentials. Production uses HTTPS and same site frontend and API hosts.
* Residents can self register. Vendor and ops accounts remain seed only.
* Logout removes the browser cookie but does not revoke a copied stateless JWT before its 24 hour expiry.

**Configuration required**:
* `CORS_ALLOWED_ORIGINS`: comma separated exact browser origins. Include `http://localhost:5173` for local development and the production frontend origin.
* `VITE_API_BASE_URL`: FastAPI base URL for the Vite app.

**Critical test scenarios**:
* Login sets the access cookie, returns no token in JSON, and `/auth/me` returns the correct role profile, verifies **AC-1** and **AC-4**.
* Wrong password and unknown username produce the same user facing message, verifies **AC-2**.
* Empty and overlong signup fields map to field messages. Invalid invite code maps to the invite field, duplicate username or phone maps to the form message, and a network failure keeps the entered values, verifies **AC-2** and **AC-3**.
* Signup with all six fields creates a resident, logs them in, and reaches the resident page. A failed chained login returns to Login with the username filled in, verifies **AC-3**.
* A missing, invalid, expired, or unsigned CSRF token, and a missing or disallowed Origin, are rejected. A valid CSRF token is reused across tabs. After concurrent first token requests, a stale token is rejected and succeeds only after a fresh token is fetched and the user resubmits. Preflight permits only the required methods and headers. An allowed browser origin can complete login, verifies **AC-8**.
* Logout followed by login fetches a fresh CSRF token before enabling submission, verifies **AC-6** and **AC-8**.
* Profile failure leaves protected pages hidden and attempts logout. A 401 on a protected request shows the session expired message. Logout clears the cookie when the backend is reachable, verifies **AC-5** and **AC-6**.
* Resident, vendor, and ops profiles reach only their matching page. An unexpected role cannot open a role page. A null society omits the society line, verifies **AC-6** and **AC-7**.
* Keyboard use, visible focus, associated form errors, password toggle, and 360 by 800 px and 1280 by 800 px layouts are checked, verifies **AC-9**.
* Directly open and refresh every client route in development and preview. Verify production fallback before release, verifies **AC-10**.

## Build plan

1. [ ] Scaffold a TypeScript React and Vite app with React Router and Tailwind CSS. Add the API URL setting. Update FastAPI with exact credentialed CORS, CSRF token issuance and checks, cookie login, cookie profile access, and logout. Prove one browser login reaches `/auth/me`, satisfies **AC-1**, **AC-4**, and **AC-8**.
2. [ ] Add the shared API client and auth context. Restore sessions before rendering routes, handle profile failures, add logout, role guards, and the three placeholder role pages. Satisfies **AC-5**, **AC-6**, and **AC-7**.
3. [ ] Add the resident signup form with all backend fields, validation, server error mapping, automatic login, and the login fallback. Satisfies **AC-2** and **AC-3**.
4. [ ] Build the shared form components and apply the guide's mobile first layout, text wordmark, calm teal accent, and accessible loading, focus, and error states. Test the full error matrix, role flows, responsive layout, and direct route refresh. Satisfies **AC-2**, **AC-7**, **AC-9**, and **AC-10**.

## Consequences

**Positive**:
* JavaScript cannot directly read the access token.
* TypeScript checks frontend profile and session shapes during the build.
* Login, signup, session restore, logout, and role navigation follow one documented browser flow.
* The implementation matches the backend's required signup fields and optional society relation.

**Negative / tradeoffs**:
* Cookie security requires CSRF handling, exact CORS origins, and same site production hosting.
* A network failure can leave an HttpOnly cookie in the browser because JavaScript cannot delete it.
* Logout does not revoke a copied JWT. A copied token can remain valid until its 24 hour expiry.
* External clients that expect a bearer token in the login response will need a compatibility path or migration.

**Neutral**:
* No database migration is needed.
* The app does not include a welcome screen, password reset, OTP, refresh tokens, or real dashboards.
* Use Tailwind CSS with shared design tokens. Use the system font and a text wordmark because no logo or font assets exist.
* The frontend build includes a TypeScript compile step.
* Rate limiting and account lockout remain outside this MVP, as stated in the project architecture. Revisit them before public launch.

## Migration plan

**Strategy**: Direct replacement for the browser contract.

**Phases**:
1. Build and verify the backend cookie contract and frontend together in development.
2. Configure exact production origins and deploy the backend and frontend together under the same site.

**Rollback**: Revert the backend and frontend release together. No database state needs to be restored.

**Risks**: A client outside this repository may depend on the bearer token response. Confirm external client use before production. If one exists, keep a separate cookie endpoint and preserve the bearer contract for that client.

## Follow-up

* [ ] Confirm there are no external clients that depend on the current bearer token response before production.
* [ ] Set the exact production frontend origin in `CORS_ALLOWED_ORIGINS` and deploy the frontend and API under the same site.
* [ ] Configure the selected production host to serve the frontend entry point for `/login`, `/signup`, `/resident`, `/vendor`, and `/ops`.
* [ ] Revisit rate limiting and account lockout before public launch.
