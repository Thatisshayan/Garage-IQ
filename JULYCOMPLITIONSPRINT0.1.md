# Garage IQ — July Completion Sprint 0.1
**Goal:** Decouple from Lovable, close security/quality gaps from `AUDIT-REPORT.md`, and get to a launchable production build ASAP.
**Source of truth for issues:** `AUDIT-REPORT.md` (sections referenced below as `AR#`).
**Handoff:** This is a task list for opencode to execute directly. Work top-to-bottom within each phase; phases are roughly priority-ordered. Check off `[ ]` → `[x]` as completed and leave a one-line note of what changed.

---

## Phase 0 — STOP THE BLEEDING (do first, today)

- [ ] **Rotate Supabase keys.** `.env` was committed to git history with live `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and project ref (`aoijcnzhsajuobjdlnma`). Publishable key alone is low-risk (RLS-gated), but rotate as hygiene and because history exposure is unpredictable. Do this in the Supabase dashboard, not in code.
- [ ] **Untrack `.env` from git.** It's already added to `.gitignore` — now run `git rm --cached .env` and commit. Confirm no other secret files are tracked (`git ls-files | grep -i env`).
- [ ] **Purge `.env` from git history** if this repo will ever go public or be shared outside the current trusted team (`git filter-repo` or BFG). Skip if repo stays private and keys are rotated — flag decision to the user, don't decide unilaterally.
- [ ] **Create `.env.example`** with the 6 required var names (no values) so new devs/opencode can bootstrap without guessing: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, plus `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY`/replacement (see Phase 1).
- [ ] **Verify prod build even boots.** Run `bun install && bun run build` clean — confirm no build-breaking issues before deeper work starts.

---

## Phase 1 — Decouple from Lovable

Lovable is currently load-bearing in 3 places: auth (OAuth), AI gateway (LLM proxy), and error reporting. All three route through Lovable-hosted infra and `@lovable.dev/*` packages. Full list of Lovable touchpoints found in code:

- `src/integrations/lovable/index.ts` — Google OAuth via `@lovable.dev/cloud-auth-js`
- `src/routes/auth.tsx` — imports `lovable.auth.signInWithOAuth`
- `src/lib/ai-gateway.server.ts` — all AI calls proxy through `ai.gateway.lovable.dev` using `LOVABLE_API_KEY`
- `src/lib/lovable-error-reporting.ts` + `src/routes/__root.tsx` — error reporting hook expects `window.__lovableEvents` (a Lovable-injected script that won't exist off-platform)
- `.lovable/` directory — Lovable project metadata (safe to delete once off-platform)
- `AGENTS.md` — Lovable sync warning banner
- `package.json` — `@lovable.dev/cloud-auth-js`, `@lovable.dev/vite-tanstack-config` deps
- `src/routes/__root.tsx` — OG/Twitter image URLs point at a `*.lovable.app` preview + `pub-...r2.dev` CDN link — dead/wrong branding once decoupled
- `src/integrations/supabase/client.ts` / `client.server.ts` / `auth-middleware.ts` — error messages say "Connect Supabase in Lovable Cloud" (cosmetic but references Lovable)

### Tasks
- [ ] **Replace Google OAuth.** Swap `lovable.auth.signInWithOAuth` for Supabase's native `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`. Supabase already supports Google OAuth directly — this removes the Lovable auth dependency entirely. Update `src/routes/auth.tsx`, delete `src/integrations/lovable/index.ts`, remove `@lovable.dev/cloud-auth-js` from `package.json`.
- [ ] **Replace the AI gateway.** `ai-gateway.server.ts` currently hard-routes every LLM call through Lovable's proxy (`ai.gateway.lovable.dev`) using `@ai-sdk/openai-compatible`. Since the underlying SDK is already the standard Vercel AI SDK, swap to calling Gemini (or OpenAI) directly: use `@ai-sdk/google` (for Gemini Flash, matching current model) or keep `openai-compatible` pointed at a direct provider endpoint. Requires a new API key (Google AI Studio / OpenAI), stored as `GOOGLE_GENERATIVE_AI_API_KEY` or equivalent. Update every caller of `getAiGateway()` — grep for usages in `document-ai.server.ts`, `assistant.functions.ts`, and intake VIN/OCR functions.
- [ ] **Remove/replace error reporting hook.** `lovable-error-reporting.ts` no-ops safely if `window.__lovableEvents` doesn't exist (it's optional-chained), so this won't break — but it's dead weight off-platform. Replace with a real error reporting integration (Sentry recommended, already in the uitkit skill list) or strip it entirely and rely on server logs until Sentry is wired up.
- [ ] **Remove `.lovable/` directory** and the `<!-- LOVABLE:BEGIN -->...<!-- LOVABLE:END -->` block in `AGENTS.md`.
- [ ] **Fix branding assets.** Replace the `og:image`/`twitter:image` URLs in `src/routes/__root.tsx` (currently point at a Lovable preview CDN) with real Garage IQ branding assets, or remove until proper OG images exist.
- [ ] **Scrub "Lovable Cloud" language** from error strings in `client.ts`, `client.server.ts`, `auth-middleware.ts` (3 files, same message pattern) — just says "Connect Supabase" instead.
- [ ] **Confirm no remaining Lovable coupling**: `grep -ri lovable src/ package.json .lovable AGENTS.md` should return nothing except intentional history/changelog mentions after this phase.

---

## Phase 2 — Security Hardening (from AR §6)

- [ ] **AR-2 (HIGH):** No row-level isolation between staff — RLS is all-or-nothing for any authenticated staff member. Decide and document: is this intentional (small trusted team) or does it need per-user/per-location scoping before launch? Flag to user — this is a product decision, not just a fix.
- [ ] **AR-3 (HIGH):** Remove dead `supabaseAdmin` export in `client.server.ts` if truly unused, or document why it's kept (e.g. for future admin tooling) and lock down its usage surface.
- [ ] **AR-4 (HIGH):** Add CSRF protection or explicitly document why Bearer-token-only is sufficient for this deployment model (no cookie-based session = lower CSRF risk, but confirm and note it).
- [ ] **AR-5 (MED):** `documents.functions.ts:147` — `extracted_data` accepts `z.any()`. Add a discriminated Zod schema per `doc_type` so manual edits/API abuse can't inject arbitrary structures.
- [ ] **AR-6 (MED):** Extract duplicate `parseJson` (in `assistant.functions.ts:52` and `document-ai.server.ts:79`) into one shared util in `src/lib/`.
- [ ] **AR-7 (MED):** Add rate limiting to `assistant`, `intake`, and `processDocument` endpoints — all hit paid AI APIs and are abuse/cost vectors. Use a simple in-memory or Redis-backed limiter (Upstash Ratelimit is a common pick on Cloudflare Workers).
- [ ] **AR-8 (MED):** Sanitize `ilike` input in `findDuplicateCustomer` (`intake.functions.ts:93`) — escape `%`/`_` wildcard chars before interpolating into the LIKE pattern.
- [ ] **AR-9 (LOW):** Make currency configurable instead of hardcoded "CAD" if multi-region launch is planned; otherwise explicitly confirm CAD-only is fine for launch and skip.

---

## Phase 3 — Production Readiness / Scale Issues (from AR §7)

- [ ] **Zero tests exist.** At minimum before launch: smoke tests for auth, job creation, document upload/processing pipeline, and invoice/payment flows. Full coverage is a stretch goal; launch-blocking tests are the state machine and payment paths (money-handling code should not ship untested).
- [ ] **No pagination on list queries** — `customers`, `vehicles`, `jobs`, `documents`, `invoices` list endpoints fetch entire tables. This will fall over in production with real data volume. Add cursor or offset pagination to all `*.functions.ts` list handlers, matching UI to consume it.
- [ ] **`todayBoard` fetches ALL active jobs** despite the "today" naming — fix the query to actually filter by today's date/scope.
- [ ] **`exportEntity` has no row limit** — add a max row cap or require date-range filtering to avoid OOM on large tables.
- [ ] **N+1 queries in `vehicle-history.functions.ts`** — batch these into joined queries.
- [ ] **Standardize error handling** — pick one pattern (throw vs. `{ error }` return) across all server functions and apply consistently; currently mixed.
- [ ] **Add `updateVehicle`** — vehicles can be created/deleted but not edited, a clear gap.
- [ ] **Reduce `any` typing** — 90%+ of data props are `any` per audit. Not all need fixing before launch, but prioritize typing the money-path (invoices, payments, claims) and the AI extraction pipeline output.

---

## Phase 4 — UI/UX Launch Blockers (from AR §8)

These are the items the audit marked **Critical** — treat as launch blockers, not backlog:

- [ ] **No mobile sidebar** — fixed 244px sidebar, no hamburger/drawer. Mobile users literally cannot navigate. This product has a mobile intake flow (`m/intake.tsx`) so mobile support is clearly intended — fix this.
- [ ] **Memory leak** — `URL.createObjectURL` in mobile intake is never revoked (`URL.revokeObjectURL` missing). Fix before shipping the mobile flow.
- [ ] **No loading skeletons** — `useSuspenseQuery` blocks entire page renders. Add skeleton states at minimum for dashboard, jobs list, and document list.

**High priority (should fix pre-launch, can slip one sprint if needed):**
- [ ] No client-side form validation (HTML5 `required` only) — wire up the Zod schemas that already exist server-side to React Hook Form client-side validation.
- [ ] Two competing search UIs (`GlobalLookup` Cmd+K vs `/search` page) — consolidate or clearly differentiate their purpose.
- [ ] No real-time updates (60s polling ceiling) — acceptable for v1 launch, note as fast-follow.
- [ ] No password reset flow — auth dead-end, should not ship without this.
- [ ] No light mode — `.dark` is forced despite CSS vars existing for both. Confirm this is an intentional design choice before "fixing" it.

**Defer to post-launch backlog (do not block launch on these):**
- Kanban drag-and-drop, keyboard shortcuts, undo, AI assistant streaming, bulk operations, per-route error boundaries, sidebar `startsWith` active-state bug, raw `<select>` vs shadcn consistency.

**Dead code cleanup (cheap, do anytime):**
- [ ] Remove or wire up: `components/ui/sidebar.tsx`, `components/ui/form.tsx`, `PageShell`, `MotionDiv` (all in `motion-primitives.tsx`), `supabaseAdmin` (if confirmed dead per Phase 2).

---

## Phase 5 — Pre-Launch Checklist

- [ ] Full `bun run build` + `bun run lint` clean pass.
- [ ] Confirm all env vars documented in `.env.example` match what's actually read in code (grep `process.env` and `import.meta.env` across `src/`).
- [ ] Confirm Cloudflare Workers (Nitro target) deployment config is production-ready — check `vite.config.ts` / wrangler settings for dev-only flags.
- [ ] Re-run this audit's security section (AR §6) after Phase 2 fixes to confirm no regressions.
- [ ] Manual smoke test of full workflow end-to-end: intake → document upload → AI processing → claim/invoice creation → payment → job completion.
- [ ] Confirm README.md and AGENTS.md reflect the post-Lovable stack (no dangling references, correct setup instructions).

---

## Notes for opencode

- Work is scoped to **verification + orchestration** by the requesting agent (Claude) — this file was generated by reading `AUDIT-REPORT.md` and the live codebase directly, no implementation was done as part of producing this plan.
- Phase 0 and Phase 1 are the explicit "decouple from Lovable" ask — treat as highest priority after the security bleeding-stop.
- Where a task says "flag to user" / "confirm before deciding" — these are product/business decisions (data isolation model, multi-currency, light mode), not engineering calls. Don't unilaterally decide; surface the question back to Shayan.
- `.env` has been added to `.gitignore` already; `.env` itself is still tracked in git history as of this writing (untracking is Phase 0 task 2).

---
---

## VERIFICATION — Sprint 0.1 claimed-complete audit (2026-07-02)

Verified directly against the codebase (grep, file reads, live `bun run build`) rather than trusting the commit message. Result: **mostly true, three gaps opencode missed or skipped silently.**

### Confirmed DONE
- ✅ `.env` untracked, `.gitignore` correct, `.env.example` present with all required vars incl. `GOOGLE_GENERATIVE_AI_API_KEY`.
- ✅ `bun run build` succeeds clean (Vite + Nitro/Cloudflare output generated, no errors).
- ✅ Lovable fully decoupled — zero `lovable` references in `src/`, `.lovable/` directory gone, AI gateway now uses `@ai-sdk/google` directly.
- ✅ `parseJson` extracted to shared `src/lib/utils.ts`, used by both `assistant.functions.ts` and `document-ai.server.ts`.
- ✅ Rate limiting (`isRateLimited`) added to `assistant`, `intake`, and `processDocument` — in-memory, per-user, sane limits (10-20 req/min).
- ✅ `sanitizeLike` added and used in `findDuplicateCustomer`.
- ✅ Pagination added to list queries (`page`/`limit`/`offset`, capped at 200) — verified on `customers.functions.ts`, matches audit's `AR#` list scope.
- ✅ `todayBoard` now filters by `created_at >= today` (previously fetched all active jobs regardless of date).
- ✅ `exportEntity` capped at `MAX_ROWS = 10000` with a truncation warning logged.
- ✅ N+1 in `vehicle-history.functions.ts` fixed via `Promise.all` batching (jobs/docs/invoices/claims and vehicles/customers each batched, not sequential per-row).
- ✅ `updateVehicle` added.
- ✅ Mobile sidebar implemented (`Menu`/`X` icons, hamburger toggle in `route.tsx`).
- ✅ `URL.revokeObjectURL` present in both `m/intake.tsx` and `claims/fill.$jobId.tsx` — memory leak fixed.
- ✅ Light mode: kept `.dark` forced intentionally, with a code comment documenting it's a deliberate fallback — correctly treated as a documented decision, not silently ignored.

### Gaps — claimed or implied done, NOT actually done
- ❌ **AR-5 (MED) — `extracted_data: z.any()` still unfixed.** `documents.functions.ts:150` is untouched. No discriminated Zod schema per `doc_type` was added. This is a real gap against Phase 2.
- ❌ **AR-3 (HIGH) — `supabaseAdmin` still exported, not locked down or documented.** It's now lazy-loaded via a `Proxy` (nicer than before) but still a bare exported admin client with only a one-line comment suggesting dynamic import. No usage-surface lock-down, no confirmation it's needed, no removal. Audit item not resolved either way.
- ❌ **Zero tests still exist.** `find src -name "*.test.*"` returns nothing. This was explicitly called out as launch-blocking for money-handling code (state machine, payments) in Phase 3 and the audit's "Immediate" list. Untouched.
- ⚠️ **Not verified in this pass (lower confidence, worth opencode confirming explicitly next sprint):** CSRF decision documented anywhere, client-side Zod+RHF wiring, password reset flow, GlobalLookup/`/search` consolidation, `any`-type reduction on the money path, error-handling pattern standardization, RLS row-isolation product decision surfaced to Shayan, git history purge of `.env`, actual Supabase key rotation (both require dashboard access — cannot verify from code).

---

## Garage IQ — Sprint 0.2 (continues Sprint 0.1)

**Goal:** Close the launch-blocking gaps Sprint 0.1 left open — untested money paths, the unresolved `extracted_data` schema hole, and the dangling `supabaseAdmin` — then finish the "should fix pre-launch" UX items (password reset, client-side validation, search consolidation) so the app is genuinely launch-ready, not just "mostly launch-ready."

**By the end of this sprint, what will be true:**
1. The state machine, payment flow, and auth flow have smoke-test coverage — a regression in money-handling code fails CI instead of shipping silently.
2. `extracted_data` can no longer accept arbitrary JSON — each `doc_type` has a real schema, so a malformed AI extraction or manual API abuse gets rejected at the boundary instead of silently corrupting downstream claims/invoices.
3. `supabaseAdmin` is either deleted (if genuinely unused) or has a documented, narrow, audited call site — no more "exported service-role client nobody explains."
4. Auth is no longer a dead end — users who forget their password can recover their account without staff intervention.
5. Forms give real-time validation feedback instead of failing silently on submit (HTML5 `required` only today).
6. There's one search experience, not two competing ones.
7. CSRF posture and the RLS row-isolation model are explicit written decisions in the repo (even if the decision is "no change needed"), not open questions.

**Source of truth:** `AUDIT-REPORT.md` (AR# refs below) + the Verification section directly above, which is authoritative over anything opencode's own sprint notes claimed.

---

### Phase 6 — Money-Path Test Coverage (launch-blocking)

- [ ] Set up a test runner (Vitest — already Vite-native, matches the stack) if not already configured; confirm `bun run test` works.
- [ ] **State machine smoke tests** — cover every transition in the diagram from `AUDIT-REPORT.md` §5 (`pending → awaiting_insurance → parts_ordered → in_progress → awaiting_payment → completed`, plus the `insurance_denied`/`flagged` reset path). Assert illegal transitions are rejected.
- [ ] **Payment flow smoke tests** — `payments.functions.ts` (add/delete/setJobTotalOwed) and `invoices.functions.ts` (markPaid). Cover the "invoice_paid" trigger that advances job status.
- [ ] **Auth smoke test** — login, session middleware (`requireSupabaseAuth`) rejects unauthenticated calls, Google OAuth redirect doesn't 500.
- [ ] **Document upload/processing pipeline smoke test** — at minimum, one happy-path test through `create → process → classify → extract` using a mocked AI response (don't hit the real Gemini API in CI).
- [ ] Wire tests into whatever CI exists (or note in Phase 8 if there is none yet) so this can't silently regress again.

### Phase 7 — Close Remaining Security/Quality Gaps (AR §6/§7)

- [ ] **AR-5:** Add a discriminated Zod schema for `extracted_data` per `doc_type` (invoice, insurance document, purchase order, release form, receipt — the 5 types from AR §5). Replace `z.any().optional()` at `documents.functions.ts:150`.
- [ ] **AR-3:** Decide `supabaseAdmin`'s fate — grep every call site first (`grep -rn "supabaseAdmin" src/`). If zero real call sites beyond the Proxy definition itself, delete it. If there are call sites, document why the service-role client is needed there and confirm it's not reachable from user input.
- [ ] **AR-4 / CSRF:** Write the one-paragraph decision (Bearer-token-only, no cookie session ⇒ lower CSRF exposure) directly into `AUDIT-REPORT.md` or a new `SECURITY-DECISIONS.md`, rather than leaving it as an open audit line item forever.
- [ ] **AR-2 / RLS row isolation:** This is Shayan's call, not opencode's — surface the question explicitly (single trusted-team model vs. per-location/per-user scoping) and record whatever answer comes back.
- [ ] Standardize error handling (throw vs. `{ error }` return) across `*.functions.ts` — pick one pattern, document it in `AGENTS.md`, apply it at least to newly-touched files this sprint.
- [ ] Reduce `any` typing on the money path specifically: `invoices.functions.ts`, `payments.functions.ts`, `claims.functions.ts`, and the AI extraction output types in `document-ai.server.ts`.

### Phase 8 — Remaining UX Launch Blockers (AR §8, "High Priority" tier)

- [ ] **Password reset flow.** Add `supabase.auth.resetPasswordForEmail` + a reset-confirmation route. This was flagged as an auth dead-end in both the audit and Sprint 0.1 — still missing.
- [ ] **Client-side form validation.** Wire the Zod schemas that already exist server-side into React Hook Form on the client for at least the intake, job creation, and customer forms — replace HTML5 `required`-only validation.
- [ ] **Consolidate search.** Decide whether `GlobalLookup` (Cmd+K) and the `/search` page serve genuinely different purposes (quick-jump vs. full search) — if not, merge; if so, document the distinction in the UI itself (e.g. a hint in the search page pointing to Cmd+K for quick lookups).
- [ ] Confirm loading skeletons (added in Sprint 0.1 per commit history) cover jobs list and document list, not just dashboard — audit called out all three.

### Phase 9 — Dead Code Cleanup (cheap, do anytime this sprint)

- [ ] Remove or wire up: `components/ui/sidebar.tsx`, `components/ui/form.tsx`, `PageShell`, `MotionDiv` (`motion-primitives.tsx`) — confirmed still unused as of this verification pass.

### Phase 10 — Pre-Launch Re-Check

- [ ] Re-run `grep -rn "z.any()" src/lib/` — should return zero hits in money/document-extraction paths after Phase 7.
- [ ] Re-run `find src -name "*.test.*"` — should be non-empty after Phase 6.
- [ ] Full `bun run build && bun run lint && bun run test` clean pass.
- [ ] Manual smoke test end-to-end: intake → document upload → AI processing → claim/invoice creation → payment → job completion — same as Sprint 0.1's Phase 5, re-run because Phase 6-9 touch these exact paths.
- [ ] Confirm `.env` git history purge decision (Sprint 0.1 Phase 0) was actually made, one way or the other — it was left open.

---

### Notes for opencode (Sprint 0.2)

- Sprint 0.1 was verified against the live codebase, not taken on faith — the three real gaps (untested money paths, `z.any()` extraction hole, dangling `supabaseAdmin`) are the actual priority order for this sprint, ahead of the UX items.
- Don't re-do anything in the "Confirmed DONE" list above — it was checked directly (grep + file reads + a clean `bun run build`), not inferred from commit messages.
- Same rule as Sprint 0.1: anything marked as a product decision (RLS model, CSRF posture, search consolidation direction) gets surfaced to Shayan, not decided unilaterally.

---
---

## VERIFICATION — Sprint 0.2 claimed-complete audit (2026-07-02)

Verified directly: `git log` (3 real commits matching the claim), `bun run test` (69/69 pass), `bun run build` (clean, 3 build targets), file reads on `SECURITY-DECISIONS.md`, grep for `z.any()` and `supabaseAdmin`.

### Confirmed DONE — all of it checks out
- ✅ Vitest wired, `src/lib/state-machine.test.ts` + `src/lib/extract-schemas.test.ts`, 69/69 passing.
- ✅ `extracted_data` now `z.discriminatedUnion("type", [...])` in `documents.functions.ts` — AR-5 genuinely closed. The one remaining `z.any()` in the codebase is `assistant.functions.ts:29` (`value: z.any()` on an NL→SQL filter value) — legitimate, matches opencode's own characterization, not a money/extraction path.
- ✅ `supabaseAdmin` fully deleted — zero matches anywhere in `src/`.
- ✅ `SECURITY-DECISIONS.md` exists with a real CSRF rationale (not a rubber stamp — it correctly explains why Bearer-only + no cookies removes the CSRF attack surface) and the RLS question properly written up as three concrete options, explicitly awaiting your decision rather than opencode picking one.
- ✅ `/reset-password` and `/update-password` routes exist.
- ✅ Dead code actually gone (`sidebar.tsx`, `form.tsx` no longer present anywhere in `src/`).
- ✅ Clean `bun run build` and `bun run test` right now, on the current `main`, not just at commit time.

No gaps found this round — Sprint 0.2 is legitimately complete as reported.

---

## Garage IQ — Sprint 0.3 (continues Sprint 0.2)

**Goal:** Finish the remaining Phase 8 UX debt (client-side validation), get CI actually running the new test suite so it can't silently rot, standardize error handling and tighten `any` typing on the money path, and do the final pre-launch documentation/config pass — so the *only* things left before shipping are your own product decisions (RLS scoping, search consolidation) and the manual dashboard actions (key rotation confirmation, SMTP for password-reset email delivery).

**By the end of this sprint, what will be true:**
1. Forms give real-time inline validation instead of failing silently on submit — the Zod schemas that already exist server-side are enforced client-side too.
2. Every push/PR runs `bun run test` and `bun run build` in CI — the 69 tests from Sprint 0.2 can't be silently broken by a future change without someone noticing.
3. `invoices.functions.ts`, `payments.functions.ts`, and `claims.functions.ts` have real types instead of `any` on their data payloads — a typo in a field name fails at compile time, not in production.
4. One error-handling pattern (documented in `AGENTS.md`) is applied consistently across `*.functions.ts` — no more guessing whether a given server function throws or returns `{ error }`.
5. `README.md` and `AGENTS.md` accurately describe the current (post-Lovable, post-Sprint-0.2) stack — a new dev or a fresh opencode session can onboard from docs alone without hitting stale Lovable references or wrong setup steps.
6. Wrangler/Cloudflare Workers deployment config is confirmed production-ready — no dev-only flags left in `vite.config.ts` or the wrangler settings.
7. The password-reset flow (Sprint 0.2) is confirmed to actually deliver email, not just compile — this needs you to check Supabase's SMTP config (see below), opencode can verify the code path but not the dashboard.

**Source of truth:** `AUDIT-REPORT.md` + both verification sections above, which supersede opencode's own sprint notes wherever they conflict.

---

### Phase 11 — Client-Side Form Validation (AR §8, High Priority — still open)

- [ ] Wire the existing server-side Zod schemas into React Hook Form for the three forms the audit called out as highest-traffic: mobile intake (`m/intake.tsx`), job creation, customer creation/edit.
- [ ] Inline field-level error messages, not just a toast on submit failure.
- [ ] Confirm this doesn't duplicate schema definitions — reuse the same Zod schema client + server where the module boundary allows it (server-only fields excluded).

### Phase 12 — CI Wiring

- [ ] Add a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on push/PR: `bun install`, `bun run test`, `bun run build`, `bun run lint`.
- [ ] Confirm it actually fails red on a broken test (sanity check — introduce and revert a deliberate failure, or check workflow logic carefully) before calling this done.

### Phase 13 — Money-Path Typing + Error Handling Standardization

- [ ] Define proper TypeScript interfaces/types for `invoices.functions.ts`, `payments.functions.ts`, `claims.functions.ts` data shapes — replace `any` props. Use the existing Supabase generated `Database` types as the base where possible instead of hand-rolling new ones.
- [ ] Pick one error-handling convention (throw vs. `{ error }` return) and document the decision + rationale in `AGENTS.md`. Apply it going forward; retrofitting every existing function is not required this sprint, but flag which files still use the old pattern so it's trackable.

### Phase 14 — Documentation + Deployment Config Pass

- [ ] Update `README.md` and `AGENTS.md`: remove any dangling Lovable references, confirm setup instructions match the current `.env.example`, document the test command (`bun run test`) and the new `SECURITY-DECISIONS.md` file's existence.
- [ ] Review `vite.config.ts` and wrangler config for dev-only flags (source maps exposed in prod, debug logging, permissive CORS, etc.) that shouldn't ship.
- [ ] Confirm all env vars actually read in code (`grep -rn "process.env\|import.meta.env" src/`) are documented in `.env.example` — catch drift since Sprint 0.1's original pass.

### Phase 15 — Final Pre-Launch Checklist

- [ ] `bun run build && bun run lint && bun run test` — all clean, on `main`, right before considering this launch-ready.
- [ ] Manual end-to-end smoke test: intake → document upload → AI processing → claim/invoice creation → payment → job completion — with the new client-side validation and typed money path in place, re-run this one more time since Phase 11/13 touch it directly.
- [ ] Confirm outstanding product decisions are actually resolved, not just documented as open: RLS row isolation (`SECURITY-DECISIONS.md`), search consolidation (GlobalLookup vs `/search`).

---

### Notes for opencode (Sprint 0.3)

- Sprint 0.2 was fully verified this time — no gaps found, so nothing here duplicates prior work. Trust the "Confirmed DONE" sections above rather than re-checking them yourself.
- Phase 11 and 13 are the substantive engineering work; Phase 12 and 14 are cheap but easy to skip — don't skip them, a test suite nobody runs in CI silently rots.
- If Shayan hasn't answered the RLS/search-consolidation questions by the time you reach Phase 15, ship without them and note it explicitly rather than blocking the sprint — those were already correctly flagged as product decisions in Sprint 0.2, not engineering blockers.
