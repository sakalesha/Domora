# Phase 2 Auth Decisions and Research

## Decisions

- **Password hashing**: use `pwdlib` with its recommended Argon2 implementation (`pwdlib[argon2]`); do not implement hashing directly or use a fast hash.
- **JWT library and algorithm**: use PyJWT with HS256 explicitly allow-listed during decode. Tokens are signed, not encrypted; put only the user UUID in `sub` and standard issue/expiry claims in the token.
- **Access-token expiry**: use a 24-hour (1,440-minute) access-token lifetime, as explicitly selected by the owner on 2026-11-16. This is longer than the 30-minute example in the FastAPI tutorial and increases the exposure window if a token is stolen. No refresh token is introduced; expired users sign in again.
- **Authorization freshness**: do not put roles in the token. Look up the current user and `is_active` flag from Postgres on every protected request. Add `is_active NOT NULL DEFAULT TRUE` to the user model/migration to make the architecture's active-state check representable.
- **Signup behavior**: successful signup creates a resident and returns a safe profile summary; the resident uses the separate login endpoint to obtain an access token. The role is omitted from the request schema.
- **Phone status**: signup returns `phone_verified: false`; no phone-verification field is accepted from callers or persisted until a verification flow is implemented.
- **Login failure behavior**: return one generic 401 for unknown username and wrong password; verify a dummy hash for an unknown username to reduce timing differences.
- **Privileged accounts**: seed script only, using complete `SEED_OPS_*` / `SEED_VENDOR_*` environment configuration; passwords must be at least 12 characters and are never stored in source control.
- **Ownership**: Phase 2 implements identity and reusable role authorization. Resource ownership filters/404 hiding are implemented with each later resource endpoint, not as a generic auth dependency.

## Rationale

These choices directly implement the approved architecture's requirements for a vetted slow password hash, signed bounded tokens, current database-backed role/account state, centralized role checks, and seed-only privileged accounts. The added active flag is needed because the Phase 1 user table did not yet contain a field for the architecture's active-user check.

## Alternatives considered

- **Password hashing**: Fast/unsalted hashes and custom hashing are rejected because they do not provide the recommended password-storage resistance.
- **Token library**: Hand-rolled JWT encoding/verification is rejected; a maintained JWT library validates signatures/claims and reduces implementation mistakes.
- **Roles in JWT**: Rejected because role changes would remain stale until token expiry; the architecture requires a database re-read.
- **Long-lived/refresh tokens**: Deferred to keep MVP auth simple and bounded; users reauthenticate after token expiry.
- **Shorter token lifetime**: The FastAPI tutorial demonstrates 30 minutes. The owner chose one day instead; database-backed account/role checks still allow a deactivated account or changed role to take effect on the next request, but the token remains valid until expiry for an active account.
- **Auto-login after signup**: Not selected; signup and login are already separate endpoints and the PRD only promises a token on login.

## References

- [FastAPI — OAuth2 with Password and JWT tokens](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) (accessed 2026-11-16): recommends PyJWT and `pwdlib` with Argon2, explains that JWTs are signed rather than encrypted, and demonstrates a 30-minute access-token expiry. Domora uses the owner-selected one-day duration instead.
- [Domora PRD, section 7.1](../../context/PRD.md#71-accounts-and-access)
- [Domora architecture, sections 5, 8.4, 10, 11](../../context/ARCHITECTURE.md)
