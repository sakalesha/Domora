# Domora Frontend: Auth Implementation Guide

Scope: login, resident signup, session handling, role-based routing and placeholder dashboards.
Stack: React + Vite (PWA deferred), against the FastAPI backend from phase two.
This is a guide, not code. You write the implementation; each section says what to build, why, and how to check it.

Items marked **VERIFY** are assumptions about your backend that I have not seen. Confirm them in Swagger (`/docs`) before relying on them.

---

## 1. Scope

**In scope**
- Welcome screen (optional), Login, Resident Signup
- Token storage, session restore on reload, global 401 handling, logout
- Role-based redirect after login (resident / vendor / ops)
- Placeholder dashboard per role

**Out of scope (deferred)**
- OTP / phone verification, forgot password, refresh tokens
- Vendor or ops signup (they are created by the seed script)
- Real dashboards, camps, bookings (phase three onwards)
- PWA install and offline support

---

## 2. Backend contract

| Endpoint | Auth | Returns | Frontend use |
| --- | --- | --- | --- |
| `POST /auth/signup` | none | safe user summary, no token | create resident account |
| `POST /auth/login` | none | `access_token`, `token_type`, `expires_in` (default 86,400 s) | start session |
| `GET /auth/me` | bearer | safe profile with role and society details | source of truth for who is logged in |

Rules the backend already enforces (do not duplicate as security, only as UX):
- Public signup always creates `role="resident"`; extra fields such as `role` are rejected.
- Vendor and ops accounts exist only via the seed script.

### Verify before writing any React
- [ ] Signup in Swagger with a valid invite code returns the user summary. Note the exact field names the request expects.
- [ ] Signup failure cases and their exact status and body shape: duplicate username, bad invite code, weak password, missing field. **VERIFY** whether each is distinguishable (different status or error code) or only by message text.
- [ ] Login failure (wrong password, unknown user) returns the same status and a generic message.
- [ ] `/auth/me` with a valid token returns role and society fields. Write down the exact field names.
- [ ] `/auth/me` with a missing, malformed and expired token returns 401.
- [ ] Password and username rules (min length, allowed characters). The frontend hints must match these.
- [ ] CORS allows your Vite dev origin (usually `http://localhost:5173`) and the `Authorization` header.
- [ ] Seeded vendor and ops credentials exist so you can test all three roles.

If any item fails, fix the backend first. A frontend built on a guessed contract has to be reworked.

---

## 3. Decisions

| Decision | Status | Recommendation | Reason |
| --- | --- | --- | --- |
| After signup: auto-login or redirect to Login | **Pending** | Auto-login | Smoother; needs a fallback to the Login screen if the chained login fails. Redirect is acceptable and has fewer failure paths. |
| Token storage | **Pending** | `localStorage` for v1 | Simple; exposed to XSS. HttpOnly cookies are safer but need backend changes (cookie flags, CSRF). Be ready to explain the trade-off. |
| Username vs email login | Decided | Username | Matches the backend |
| Role selection at signup | Decided | None | Public signup is resident-only |
| Welcome screen | Optional | Keep if time allows | Low cost, helps first-time visitors |

Record the two pending decisions in your README once chosen.

---

## 4. Design foundations

Set these once, as shared CSS variables or a small tokens file, and use them everywhere.

**Layout**
- Mobile first at 360-390 px. On wider screens, centre content in a card with max width about 420 px. No separate desktop auth layout.
- Spacing only in multiples of 8 px (8, 16, 24, 32, 48).

**Typography**
- One typeface (Inter or the system font).
- Body 16 px, helper text 14 px, headings 24-28 px.
- Input text must be at least 16 px, or iOS Safari zooms the page on focus.

**Colour**
- One accent colour (a calm teal or green) for primary buttons and links.
- Near-white background, dark grey text (not pure black), mid grey for helper text and borders.
- Red for errors only. Do not rely on colour alone: pair the error colour with text.

**Components (build once, reuse)**
- Text input with label above, helper text slot, and error slot
- Password input with show/hide toggle
- Primary button with loading state (disabled plus spinner)
- Form-level error banner
- Page shell (centred card, logo slot)

**Sizing**
- Inputs and buttons 48 px tall and full width. Minimum touch target 44 px.

**Accessibility basics**
- Every input has a real `<label>` linked to it.
- Errors are associated with their input and announced to screen readers.
- Visible focus outline. Do not remove it.
- Use correct `type` and `autocomplete` values (username, current-password, new-password) so password managers work.

---

## 5. Suggested structure

Responsibilities, not code:

```
src/
  api/        one client module (base URL, auth header, error normalising, global 401)
  auth/       auth context/provider, token storage helpers, route guard
  components/ shared UI pieces listed in section 4
  pages/      Welcome, Login, Signup, ResidentHome, VendorHome, OpsHome
  routes/     route table and role redirect
  styles/     tokens and global styles
```

Rule: pages never call `fetch` directly. They call functions from `api/`. This keeps token and error handling in one place.

---

## 6. Core modules

### 6.1 API client
Responsibilities:
- Read the base URL from an environment variable (never hard-code).
- Attach `Authorization: Bearer <token>` when a token exists.
- Convert every failure into one consistent error shape the UI understands: status, a user-facing message, and optional per-field errors.
- On a 401 from any authenticated call: clear the session and send the user to Login with a "session expired" message. Do this once, here, not per page.
- Distinguish network failure (no response) from server error responses.

Map FastAPI validation errors (422, a list of field errors) to a field-name to message map so signup can show them under the right inputs. **VERIFY** the shape against your real responses.

### 6.2 Token storage
- Store the token and an absolute expiry timestamp (now plus `expires_in` at login time).
- Provide three operations: save session, read session (returns nothing if expired), clear session.
- Treat an expired stored token as no token.

### 6.3 Auth context
State: `user`, `token`, `status` (loading, authenticated, anonymous).
Operations:
- `login(username, password)`: runs the login flow in section 7.
- `signup(fields)`: runs the signup flow.
- `logout()`: clears storage and state, goes to Login.
- Initialise on app load: restore the token, validate with `/auth/me`, then set status.

While status is `loading`, show a neutral loading screen. Never render a protected page or the Login page until status is known, otherwise users see a flash of the wrong screen.

### 6.4 Route guard and role redirect
- Protected routes: if anonymous, redirect to Login.
- Public routes (Login, Signup, Welcome): if already authenticated, redirect to the home for their role.
- Role home: resident to ResidentHome, vendor to VendorHome, ops to OpsHome.
- A user visiting another role's page is redirected to their own home.
- Remember: the guard is UX only. The backend is the real access control.

---

## 7. Flows

**Login**
1. User submits username and password (after client-side checks).
2. Button enters loading state.
3. Call login. On failure, show the generic error and stop.
4. Save token and expiry.
5. Call `/auth/me`.
6. If `/auth/me` fails: clear the saved token, show the generic error, stop. Never stay half logged in.
7. Store the user in context, redirect to the role home.

**Signup** (shown with the recommended auto-login choice)
1. User submits name, username, password, invite code.
2. Call signup. On failure, map errors to fields or the form banner. Keep the entered values.
3. On success, call login with the same credentials.
4. If login succeeds, continue as steps 4-7 of the login flow.
5. If login fails, send the user to Login with "Account created, please log in" and the username prefilled.

If you choose redirect-to-Login instead: skip steps 3-4 and go straight to step 5.

**App load**
1. Read the stored session. If none or expired, status is anonymous.
2. Otherwise call `/auth/me`. On success, status is authenticated. On 401 or failure, clear the session and set anonymous.

**Session expiry mid-use**
Any 401 clears the session, redirects to Login, and shows "Your session expired. Please log in again."

**Logout**
Clear storage and state, redirect to Login. (The token itself remains valid server-side until expiry; see section 11.)

---

## 8. Screen specifications

### 8.1 Welcome (optional)
- Logo, one-line value statement ("Book home services together with your neighbours").
- Buttons: Create account (primary), Log in (secondary).
- If skipped, the root route opens Login.

### 8.2 Login
Layout, top to bottom: logo, heading "Welcome back", Username, Password (show/hide), Log in button, link "New here? Create account".

| Element | Spec |
| --- | --- |
| Username | required, autocomplete username |
| Password | required, show/hide toggle, autocomplete current-password |
| Submit | disabled and spinner while loading, label "Logging in..." |
| Wrong credentials | form banner: "Incorrect username or password." Do not reveal which was wrong. |
| Network error | banner: "Can't reach the server. Check your connection and try again." |
| Session expired | banner shown on arrival after a 401 redirect |
| Submit key | Enter submits the form |

Do not show a "Forgot password" link (not built). Document it as a known limitation.

### 8.3 Resident signup
Fields in order: Full name, Username, Password, Society invite code. Back arrow returns to Welcome or Login.

| Field | Rule (mirror the backend, **VERIFY**) | Helper text |
| --- | --- | --- |
| Full name | required | none |
| Username | required, length and characters per backend | "Letters, numbers and underscores" (adjust to backend) |
| Password | min length per backend, show/hide, autocomplete new-password | "At least 8 characters" (adjust), shown before typing |
| Invite code | required, auto-uppercase, trim whitespace | "Ask your society committee or a neighbour for this code." |

Error copy:
- Duplicate username: "That username is already taken."
- Bad invite code: "That invite code isn't valid. Check with your society committee."
- Weak password: show the backend's rule in plain language.
- Anything unmapped: banner "Something went wrong. Please try again."

Behaviour:
- Validate on blur and on submit, not on every keystroke.
- Show errors under the relevant field in plain language, never raw status codes.
- Keep all entered values after a failed submit.
- Loading state on the button, label "Creating account...".
- Phone number: include only if the backend collects it now. Otherwise leave it out and do not add a placeholder field.

### 8.4 Placeholder dashboards
Resident, vendor and ops each show: "Hi, {name}", the society name (from `/auth/me`), the role label, and a Log out button. Nothing else. Real content comes in phase three.

---

## 9. Error handling matrix

| Situation | UI response |
| --- | --- |
| Wrong login credentials | Generic banner on Login |
| Field validation error (signup) | Message under the field |
| Duplicate username | Under Username |
| Invalid invite code | Under Invite code |
| 401 on authenticated call | Clear session, go to Login, "session expired" message |
| `/auth/me` fails after login | Clear token, generic error on Login |
| Network down or server unreachable | Banner with retry guidance, keep form values |
| 5xx | Banner "Something went wrong. Please try again." |

---

## 10. Build order and checkpoints

1. **Scaffold.** Vite + React + router, env variable for API URL, CORS configured on FastAPI.
   Checkpoint: a temporary call to the backend succeeds in the browser with no CORS error.
2. **API client.** Auth header, error normalising, global 401.
   Checkpoint: call `/auth/me` with a bad token and confirm the redirect to Login fires.
3. **Auth context and storage.** Login flow, restore on load, logout.
   Checkpoint: log in, refresh the page, still logged in; log out, refresh, still logged out.
4. **Shared components and tokens.**
   Checkpoint: render each component alone in all states (default, focus, error, loading) on a phone-sized viewport.
5. **Login screen.**
   Checkpoint: success, wrong password, network off.
6. **Signup screen.**
   Checkpoint: success, duplicate username, bad invite code, weak password, empty form, network off.
7. **Route guard, role redirect, placeholder dashboards.**
   Checkpoint: log in as seeded resident, vendor and ops; each lands on the right page and cannot open the others.
8. **Polish and device test.** Open on a real phone via your LAN address or a tunnel.
   Checkpoint: keyboard does not hide the submit button, no zoom on input focus, tap targets feel comfortable.

---

## 11. Test checklist

Functional
- [ ] Login works for resident, vendor, ops
- [ ] Signup creates a resident and lands on the resident home (or Login, per your decision)
- [ ] Refresh keeps the session; logout clears it
- [ ] Editing the stored expiry to a past time and reloading sends you to Login
- [ ] Corrupting the stored token and reloading sends you to Login without crashing
- [ ] Manually visiting another role's URL redirects you to your own home
- [ ] Logged-in user visiting Login or Signup is redirected to their home

Robustness
- [ ] Double-tapping Login or Create account sends only one request
- [ ] Back button after logout does not reveal protected content
- [ ] Failed signup keeps typed values
- [ ] Backend stopped: friendly network error, no blank screen or console crash

Quality
- [ ] Works at 360 px width and on a desktop browser
- [ ] Keyboard-only: tab order is sensible, Enter submits, focus is visible
- [ ] Password manager offers to save and fill

---

## 12. Known limitations (put these in the README)

- Logout is client-side only: a stateless access token stays valid until it expires (24 hours by default). No revocation.
- No refresh token: users log in again after expiry.
- Token in `localStorage` (if chosen): exposed to XSS; mitigated by not rendering unsanitised user content. Alternative considered: HttpOnly cookies.
- No password reset and no OTP verification.
- Vendor and ops accounts are seeded, not self-registered. The earlier spec had vendor self-registration with ops approval; update the PRD and architecture documents so they match the code.

---

## 13. Definition of done

- All three roles can log in and land on the correct placeholder page.
- A new resident can sign up with a valid invite code and reach their home.
- Every failure case in section 9 produces the specified message with no console errors.
- Session survives reload and is cleanly dropped on expiry or logout.
- Checked on a real phone.
- README documents the two decisions in section 3 and the limitations in section 12.
