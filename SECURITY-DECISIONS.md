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

## Search Consolidation (AR §8 item 5)

**Decision:** Keep both search UIs as intentionally distinct tools.

**Rationale:**
- **GlobalLookup (Cmd+K):** Quick-jump dropdown. Searches vehicles + customers only. 180ms debounce. Navigates directly to vehicle detail. For "I know who I'm looking for."
- **/search page:** Full-page form. Searches across 5 entities (customers, vehicles, jobs, documents, invoices). Returns categorized results with links. For "I need to find something I don't have a direct path to."

These serve genuinely different purposes — quick-jump vs. comprehensive search — and are not duplicates.

**Discoverability:** A hint in the `/search` page header reads: "Looking for a quick jump? Try ⌘K" so users can discover the faster path without reading docs.

**Recorded:** 2026-07-02

---

## RLS Row Isolation (AR-2)

**Decision:** Per-user scoping — each staff member sees only records they created or are assigned to.

**Rationale:**
- Customers, vehicles: scoped by `created_by` (set on insert to the creating user)
- Jobs: scoped by `assigned_to` (set on creation, reassigned as needed)
- Documents: scoped by `uploaded_by`
- Invoices, payments, claim_templates: scoped by `created_by`
- Insurance claims, job_status_events: scoped via their parent job's `assigned_to`
- Document review queue: scoped via the document's `uploaded_by`

**Implementation:** Supabase RLS policies enforce per-user isolation at the database level. Server functions set `created_by`/`assigned_to` on inserts. Existing pre-migration rows with NULL `created_by` are invisible to all staff (correct: they predate the scoping model).

**Trade-off:** Collaborative workflows where Staff B needs to work on a customer created by Staff A require reassignment or shared ownership. This is intentional — the model prioritizes data isolation over convenience.

**Recorded:** 2026-07-02

---

## Public Signup / Staff Onboarding

**Finding:** The signup form was publicly accessible with no invite code or admin approval step. A database trigger (`handle_new_user`) auto-granted every new account the `staff` role, and `requireSupabaseAuth` (the shared server-function auth gate) only validated that a request carried a valid JWT — it never checked role. This meant anyone who found the login URL could self-register, get a working staff account, and hit paid AI endpoints (assistant, document processing) at Garage IQ's expense, independent of the per-user RLS scoping added for data isolation.

**Decision:** Option A — disable public signup. New accounts are provisioned by an admin, not self-registration.

**Implementation (2026-07-02):**
- `handle_new_user()` no longer auto-grants the `staff` role on signup (migration `20260702180000_disable_auto_staff_grant.sql`). The very first user on a fresh database still auto-becomes `admin` — this preserves the bootstrap path for a new deployment.
- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) now checks `user_roles` for the caller and rejects any authenticated-but-unapproved account with `Unauthorized: Account is not an approved staff member`. This closes the cost-abuse vector directly — even if someone still manages to create an authenticated Supabase account (e.g. via Google OAuth, which Supabase auto-provisions on first sign-in), they get zero access to any server function or RLS-protected table without an explicit `user_roles` row.
- The public signup form (email/password) was removed from `/auth`; only sign-in, password reset, and "Continue with Google" remain. Google sign-in still works for *already-approved* staff, but no longer grants access on its own — an admin still has to add the resulting account to `user_roles`.

**How to add a new staff member (until an in-app invite flow exists):** have them sign in once (email/password via Supabase dashboard-created user, or Google OAuth) to create their `auth.users` row, then insert a row into `public.user_roles` (`role = 'staff'` or `'admin'`) for that `user_id` via the Supabase dashboard SQL editor or table editor.

**Recorded:** 2026-07-02
