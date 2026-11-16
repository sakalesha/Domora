# Domora Frontend

Frontend web application for Domora, built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **React Router v7**.

---

## 1. Overview & Scope

This application implements Phase 2 (Authentication & Role-Based Access) against the FastAPI backend:
- **Welcome Screen** (`/welcome` or `/` for new visitors)
- **Resident Signup** (`/signup`) with client-side validation, auto-uppercase invite code, and chained auto-login
- **Login** (`/login`) with username & password, password visibility toggle, and error mapping
- **Role-Based Routing & Dashboards**:
  - `/resident`: Resident community home
  - `/vendor`: Assigned service vendor dashboard
  - `/ops`: Society operations manager dashboard
- **Session Lifecycle**: Automatic session restore on reload, HttpOnly cookie authentication, double-submit CSRF protection (`X-CSRF-Token`), global 401 handling, and clean logout.

---

## 2. Key Architecture Decisions

| Decision | Selected Option | Rationale |
| :--- | :--- | :--- |
| **Post-Signup Flow** | **Auto-login** | Provides a seamless onboarding experience. If the chained login call fails for any reason, the user is safely redirected to `/login` with their username prefilled and a helpful notice. |
| **Session & Token Storage** | **HttpOnly Cookies + CSRF Protection** | Session JWT tokens are stored in `HttpOnly`, `SameSite=Lax` cookies, preventing client-side script access (mitigating XSS). Mutating requests (`POST`) are protected against Cross-Site Request Forgery via signed, origin-validated `X-CSRF-Token` headers. |
| **Authentication Identity** | **Username** | Direct match with the backend identity schema. |
| **Registration Scope** | **Resident only** | Vendor and Ops accounts are provisioned via administrative seeds, ensuring tight security boundaries. |

---

## 3. Known Limitations (MVP Scope)

- **Stateless Token Expiry:** Logout clears client cookies; backend access tokens are stateless and expire after 24 hours. No distributed revocation list is used in this MVP.
- **No Refresh Tokens:** When a session expires (after 24 hours), the user is prompted to sign in again.
- **No Password Reset / OTP:** Phone verification and password recovery workflows are out of scope for the current MVP.
- **Role Provisioning:** Only residents can register through the public UI. Vendor and ops accounts exist exclusively through the backend seed scripts.

---

## 4. Development

### Prerequisites
- Node.js 20+
- Backend running at `http://localhost:8000`

### Setup
```bash
# Install dependencies
npm install

# Start Vite dev server (runs at http://localhost:5173)
npm run dev

# Lint code with Oxlint
npm run lint

# Build for production
npm run build
```
