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
