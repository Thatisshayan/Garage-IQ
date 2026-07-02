# Security Decisions — Garage IQ

## CSRF Posture (AR-4)

**Decision:** No explicit CSRF token protection. Bearer-token-only auth is sufficient for this deployment model.

**Rationale:**
- All server functions use POST with `Authorization: Bearer <JWT>` header auth
- No cookie-based sessions are used — Supabase stores tokens in `localStorage` on the client
- CSRF attacks rely on browsers automatically attaching cookies to cross-origin requests; without cookies, there's nothing for a CSRF attack to leverage
- The JWT is attached explicitly via the `auth-attacher` middleware, not automatically by the browser
- This is the standard security model for SPAs using token-based auth

**Risk:** Low. If the deployment model ever changes to use cookie-based sessions, CSRF protection must be added.

**Recorded:** 2026-07-02

---

## RLS Row Isolation (AR-2)

**Status:** FLAGGED TO SHAYAN — product decision required.

**Question:** Should staff members see only their own records, or all records in the garage?

**Current behavior:** All authenticated staff can read/modify ALL rows in ALL tables. No row-level isolation between staff members.

**Options:**
1. **Keep current model (trusted team)** — All staff see everything. Simpler, appropriate for small garages where everyone trusts each other.
2. **Per-user scoping** — Each staff member sees only records they created or are assigned to. More secure but adds complexity and may break collaborative workflows.
3. **Per-location scoping** — If the garage has multiple locations, staff only see their location's records. Requires a `location_id` column on all tables.

**Awaiting decision from Shayan before implementing.**
