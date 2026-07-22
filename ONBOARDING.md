# Garage IQ — Staff Onboarding Guide

Garage IQ does not have public signup. Every account is added by an admin.
This is intentional (see `SECURITY-DECISIONS.md` → "Public Signup / Staff
Onboarding") — it stops strangers from creating free accounts that hit paid
AI endpoints.

## For Admins: Adding a New Staff Member

There's no in-app "invite" button yet, so approval is a two-step manual
process:

1. **Have the new person sign in once**, using either:
   - Email + password (an admin creates the login in Supabase dashboard →
     Authentication → Users → **Add user**), or
   - "Continue with Google" on the `/auth` page — this creates their account
     automatically on first click, but grants **zero access** until step 2

2. **Approve the account** in Supabase:
   - Open https://supabase.com/dashboard/project/fiegxbfoogbfaaeyrbuq
   - **Authentication → Users** — find the new account, copy its `User UID`
   - **Table Editor → `user_roles`** — insert a row:
     - `user_id` = the UID you copied
     - `role` = `staff` (day-to-day use) or `admin` (can approve others, full
       access)
   - Done — no redeploy or restart needed. The new person can sign in (or
     refresh, if already signed in) and will have access immediately.

**Note on the very first account:** on a brand-new database, the *first*
person ever to sign in is auto-promoted to `admin` — this is the bootstrap
path so the system isn't a chicken-and-egg problem on day one. Every account
after that needs the manual approval above.

**Common trip-up:** Google and email/password are separate identities in
Supabase even for the same email address. If you already bootstrapped via
email/password and then also try Google sign-in, the Google identity is a
*second*, unapproved account — you'll need to approve it separately (or just
stick to one sign-in method per person).

## For New Staff: Signing In

1. Go to the app's `/auth` page
2. If an admin created your login: use your email + password
3. If you're signing in with Google: click **Continue with Google**, pick
   your Google account
4. If you see `"Unauthorized: Account is not an approved staff member"` —
   you're not approved yet. Ask an admin to add you (see above). This is not
   a bug; it means your account exists but hasn't been granted access.

## Day-to-Day Use — Feature Map

| Area | What it's for |
|---|---|
| **Dashboard** | Live KPIs — jobs by status, review queue, unpaid invoices, flagged jobs |
| **Work Orders** | Kanban/table view of jobs, with full status-change audit trail |
| **Quick Intake** | Mobile 6-step wizard for bringing in a new vehicle — snap a photo, AI reads VIN/plate/odometer |
| **Today Board** | Daily floor view — what's outstanding, who to call |
| **Customers / Vehicles** | Records with full linked history (jobs, documents, claims, invoices) |
| **Documents** | Upload → AI classifies and extracts data automatically (invoices, insurance docs, POs, release forms, receipts). Auto-approves ≥90% confidence, flags 70–90% for review, routes <70% to manual entry |
| **Review Queue** | Documents the AI wasn't confident about — human resolves them here |
| **AI Assistant** | Ask questions about your garage data in plain English (e.g. "which jobs are awaiting insurance approval?") — read-only, cannot modify data |
| **Insurance Claims** | Track claim status (pending/approved/denied/partial) |
| **Claim Templates** | Upload a blank insurer PDF once, map its fields to garage data, auto-fill it for every future claim to that insurer |
| **Invoices** | Payment status tracking, mark-paid, PDF generation |
| **Search (⌘K)** | Quick-jump to a specific vehicle/customer. The full `/search` page instead searches all 5 entity types when you don't know exactly what you're looking for |
| **Exports** | CSV/JSON export, per entity |

## Data Visibility Rules (Important)

Garage IQ scopes most records **per staff member**, not garage-wide:
- Customers/vehicles: visible to whoever created them
- Jobs: visible to whoever they're assigned to
- Documents: visible to whoever uploaded them

If a coworker can't see a record you created, that's expected — it needs to
be reassigned to them, not a bug. (See `SECURITY-DECISIONS.md` → "RLS Row
Isolation" for the reasoning.)

## Troubleshooting Quick Reference

| Symptom | Cause | Fix |
|---|---|---|
| "Unauthorized: Account is not an approved staff member" | Signed in but no `user_roles` row | Admin approves via Supabase Table Editor (see above) |
| Google sign-in redirect fails / error page from Google | Supabase Auth provider misconfigured, or the current URL isn't in Supabase's allowed redirect list | Check Supabase → Authentication → URL Configuration → Site URL / Redirect URLs includes your current domain |
| Coworker's records missing from my view | Per-user data scoping (by design) | Reassign the record, or have both people work under one shared account for that entity |
| AI document review flags almost everything | Confidence threshold, not a bug | Threshold is fixed at 70/90% for now — flagged items just need a quick human glance |
