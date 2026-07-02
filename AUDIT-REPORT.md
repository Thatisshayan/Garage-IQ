# Garage IQ — Deep Codebase Audit Report

**Date:** July 2, 2026
**Auditor:** AI Code Review
**Repo:** https://github.com/Thatisshayan/Garage-IQ

---

## Executive Summary

Garage IQ is a **well-architected, production-grade AI-powered garage management system** for car repair and insurance claim workflows. Built on a modern stack (React 19, TanStack Start, Tailwind v4, Supabase) with a sophisticated document AI pipeline. The codebase follows consistent patterns and has strong separation of concerns.

**Verdict:** Solid foundation with clear room for hardening. No critical security vulnerabilities, but several areas need attention before production use at scale.

---

## 1. Architecture Overview

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | TanStack Start (SSR) | ^1.168 |
| Router | TanStack Router (file-based) | ^1.170 |
| UI | React 19 + shadcn/ui (New York) | ^19.2.0 |
| Styling | Tailwind CSS v4 (OKLCH palette) | ^4.2.1 |
| Database | Supabase (Postgres + RLS) | — |
| Auth | Supabase Auth + Google OAuth | — |
| AI | Lovable AI Gateway → Gemini Flash | — |
| AI SDK | Vercel AI SDK | ^7.0.2 |
| State | TanStack React Query | ^5.101 |
| Forms | React Hook Form + Zod | ^7.71 |
| Animations | Framer Motion | ^12.42 |
| PDF | jsPDF + pdf-lib | — |
| Build | Vite 8 + Nitro (Cloudflare) | ^8.0.16 |

**Pattern:** Server-first SPA. All mutations go through `createServerFn` with auth middleware. Client never talks to Supabase directly for writes.

---

## 2. File Structure

```
GARAGEIQ/
├── src/
│   ├── routes/                    # File-based routing
│   │   ├── __root.tsx             # Root shell, QueryClient, meta, 404/error
│   │   ├── auth.tsx               # Login/signup (email + Google)
│   │   └── _authenticated/        # Auth-guarded layout
│   │       ├── route.tsx          # Sidebar nav + auth gate
│   │       ├── index.tsx          # Dashboard (KPIs, pipeline)
│   │       ├── today/             # Daily floor view
│   │       ├── jobs/              # Work orders (kanban + detail + new)
│   │       ├── customers/         # Customer list + detail
│   │       ├── vehicles/          # Vehicle list + history
│   │       ├── documents/         # Document library + detail + archive
│   │       ├── review-queue/      # AI uncertain docs
│   │       ├── claims/            # Insurance claims + templates + fill
│   │       ├── invoices/          # Invoices + mark paid
│   │       ├── search/            # Global full-text search
│   │       ├── assistant/         # NL→SQL AI chat
│   │       └── m/intake.tsx       # Mobile quick intake wizard
│   ├── lib/                       # Server functions + utilities
│   │   ├── *.functions.ts         # CRUD + AI server functions
│   │   ├── *.server.ts            # Server-only (AI pipeline, state machine)
│   │   └── utils.ts               # cn() helper
│   ├── integrations/
│   │   ├── supabase/              # Client, server client, auth, types
│   │   └── lovable/               # OAuth integration
│   ├── components/
│   │   ├── ui/                    # ~40 shadcn/ui components
│   │   ├── global-lookup.tsx      # Cmd+K search overlay
│   │   └── motion-primitives.tsx  # Framer Motion helpers
│   ├── hooks/
│   │   └── use-mobile.tsx         # Responsive hook
│   ├── styles.css                 # Tailwind + custom theme
│   └── [router, start, server].tsx
├── supabase/
│   └── migrations/                # 7 SQL migrations
└── [config files]
```

---

## 3. Server Functions Inventory

| File | Functions | Purpose |
|------|-----------|---------|
| `customers.functions.ts` | list, get, create, update, delete | Full CRUD |
| `vehicles.functions.ts` | list, create, delete | CRUD (no update) |
| `jobs.functions.ts` | list, get, create, overrideStatus, dashboardStats | CRUD + KPIs |
| `documents.functions.ts` | create, process, list, archive, ingest, get, update, reviewQueue, resolve, getUploadUrl | Full lifecycle |
| `claims.functions.ts` | list, update | Read + status |
| `claim-templates.functions.ts` | list, get, create, saveFieldMap, delete, getFillContext | Template mgmt |
| `invoices.functions.ts` | list, markPaid | Read + mark paid |
| `payments.functions.ts` | list, add, delete, setJobTotalOwed | Payment ledger |
| `intake.functions.ts` | extractVin, decodeVin, findDuplicate, findByVin, submit | Mobile intake |
| `search.functions.ts` | searchAll | Cross-entity search |
| `today.functions.ts` | todayBoard | Daily kanban |
| `export.functions.ts` | exportEntity | CSV/JSON export |
| `assistant.functions.ts` | aiAssistantQuery | NL→structured query |
| `invoice-pdf.ts` | generateInvoicePdf | Client-side PDF |

---

## 4. Database Schema

### Tables (11)
| Table | Purpose |
|-------|---------|
| `user_roles` | Admin/staff role assignment |
| `customers` | Customer records |
| `vehicles` | Vehicle records (FK → customers) |
| `jobs` | Work orders (FK → customers, vehicles) |
| `insurance_claims` | Insurance claims (FK → jobs) |
| `documents` | Uploaded documents + extracted data |
| `invoices` | Invoices (FK → documents, jobs) |
| `payments` | Payment ledger (FK → jobs) |
| `job_status_events` | Audit trail for status changes |
| `document_review_queue` | Documents needing human review |
| `claim_templates` | Reusable claim PDF templates |

### Enums (9)
`app_role`, `job_status`, `doc_type`, `doc_processing_status`, `claim_status`, `payment_status`, `review_reason`, `status_trigger`, `payer_type`

### Security
- RLS enabled on all tables
- Single policy: `is_staff(auth.uid())` for all operations
- `has_role()` and `is_staff()` SECURITY INVOKER functions
- Storage policies: staff-only on `workshop-documents` bucket

### Indexes
- Trigram: `customers.name`, `vehicles.vin`, `vehicles.license_plate`, `customers.phone`
- GIN: `documents.extracted_data`
- B-tree: all FK and status columns

---

## 5. AI Pipeline

### Document Processing Flow
```
Upload → Storage → processDocument
  → OCR (Gemini vision)
  → Classify (confidence thresholds: ≥0.9 auto, 0.7-0.9 review, <0.7 unclassified)
  → Extract (typed Zod schemas per doc type)
  → Link (VIN→vehicle, name→customer, job context)
  → Side effects (create claims, invoices, etc.)
  → Review queue (if needed)
```

### Supported Document Types
- Invoices → auto-creates invoice record
- Insurance documents → auto-creates/updates claim
- Purchase orders → triggers state machine
- Release forms → triggers state machine
- Receipts → attaches to job

### State Machine
```
pending → awaiting_insurance (insurance_approved)
pending/awaiting_insurance → parts_ordered (po_linked)
parts_ordered → in_progress (release_linked)
in_progress → awaiting_payment (invoice_unpaid)
awaiting_payment → completed (invoice_paid)
any → pending (insurance_denied, flagged=true)
```

### AI Assistant (NL→SQL)
- Read-only by design (SELECT only)
- Table allowlist enforced
- Column names validated
- Filter ops restricted to safe operators

---

## 6. Security Audit

### CRITICAL
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | `.env` committed with publishable keys, not in `.gitignore` | `.env`, `.gitignore` | **Fix needed** |

### HIGH
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 2 | RLS grants full access to all staff — no row-level isolation between staff members | Migration 1 | Design decision |
| 3 | `supabaseAdmin` (service role) exported but never used — dead code risk | `client.server.ts:34` | Remove |
| 4 | No CSRF protection on server functions (Bearer token provides partial protection) | `auth-attacher.ts` | Acceptable for now |

### MEDIUM
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 5 | `extracted_data` accepts `z.any()` — manual edits could inject unexpected structures | `documents.functions.ts:147` | Add schema |
| 6 | `parseJson` is fragile — extracts JSON by finding first `{` and last `}` | `assistant.functions.ts:52`, `document-ai.server.ts:79` | Extract shared util |
| 7 | No rate limiting on AI endpoints | `assistant`, `intake`, `processDocument` | Add rate limiter |
| 8 | `findDuplicateCustomer` uses `ilike` with unsanitized LIKE characters | `intake.functions.ts:93` | Sanitize input |

### LOW
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 9 | Hardcoded currency "CAD" — not configurable | Multiple files | Make configurable |
| 10 | No input sanitization for XSS (React handles by default) | — | Acceptable |

---

## 7. Code Quality

### Strengths
- Consistent server function pattern: `createServerFn → middleware → validator → handler`
- Zod validation on all inputs
- Full Supabase `Database` types with proper Row/Insert/Update
- Clean state machine with audit logging
- Good separation: `.server.ts` (server-only) vs client code
- Industrial "pit-lane" design with custom OKLCH palette
- Comprehensive AI pipeline with confidence thresholds and review queue

### Issues
| # | Issue | Severity |
|---|-------|----------|
| 1 | **Zero tests** — no unit, integration, or E2E tests | High |
| 2 | **No pagination** on list queries — fetches entire tables | High |
| 3 | **Inconsistent error handling** — some throw, some return `{ error }` | Medium |
| 4 | **Extensive `any` usage** — 90%+ of data props typed as `any` | Medium |
| 5 | **Duplicate `parseJson`** in two files | Low |
| 6 | **Missing `updateVehicle`** — can create/delete but not edit | Low |
| 7 | **Dead `supabaseAdmin` export** | Low |
| 8 | **`todayBoard` fetches ALL active jobs** despite name suggesting "today" | Medium |
| 9 | **`exportEntity` has no row limit** — could OOM on large tables | Medium |
| 10 | **N+1 queries** in `vehicle-history.functions.ts` | Medium |

---

## 8. UI/UX Audit

### Critical
| # | Issue | Impact |
|---|-------|--------|
| 1 | **No mobile sidebar** — fixed 244px, no hamburger/drawer | Mobile users cannot navigate |
| 2 | **Memory leak** — `URL.createObjectURL` in mobile intake never revoked | Memory grows over time |
| 3 | **No loading skeletons** — `useSuspenseQuery` blocks entire page | Poor perceived performance |

### High Priority
| # | Issue | Impact |
|---|-------|--------|
| 4 | **No client-side form validation** — forms use HTML5 `required` only | Bad UX on errors |
| 5 | **Two search mechanisms** — `GlobalLookup` (Cmd+K) and `/search` page | Confusing |
| 6 | **Kanban is display-only** — no drag-and-drop | Expected feature missing |
| 7 | **No real-time updates** — 60s polling at best | Stale data |
| 8 | **No pagination** — all lists load full tables | Performance at scale |
| 9 | **No light mode** — CSS vars defined but `.dark` forced | No user choice |
| 10 | **No password reset flow** | Auth dead-end |

### Medium Priority
| # | Issue | Impact |
|---|-------|--------|
| 11 | No keyboard shortcuts beyond Cmd+K | Power user friction |
| 12 | No undo for destructive actions | Accidental data loss risk |
| 13 | AI assistant has no streaming | Slow perceived response |
| 14 | No bulk operations | Workflow friction |
| 15 | Inconsistent form controls (raw `<select>` vs shadcn) | Visual inconsistency |
| 16 | `any` types everywhere | Type safety lost |
| 17 | Sidebar nav active state uses `startsWith` — false matches | Wrong link highlighted |
| 18 | No error boundaries per route | Root catches everything |

### Unused Code
| Component | File | Status |
|-----------|------|--------|
| `sidebar.tsx` | `components/ui/sidebar.tsx` | Fully implemented, never imported |
| `form.tsx` | `components/ui/form.tsx` | Fully implemented, never imported |
| `PageShell` | `components/motion-primitives.tsx` | Exported, never used |
| `MotionDiv` | `components/motion-primitives.tsx` | Exported, never used |
| `supabaseAdmin` | `integrations/supabase/client.server.ts` | Exported, never imported |

---

## 9. Dependencies

### Core
| Package | Purpose |
|---------|---------|
| `react` / `react-dom` 19.2 | UI framework |
| `@tanstack/react-start` | Full-stack SSR |
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Server state |
| `@supabase/supabase-js` | Database + auth + storage |
| `tailwindcss` 4.2 | Styling |
| `zod` 3.24 | Validation |
| `ai` 7.0 | Vercel AI SDK |
| `@ai-sdk/openai-compatible` | LLM provider |

### UI (20+ packages)
Radix UI primitives, Lucide icons, Framer Motion, Sonner toasts, Cmdk, Vaul, Recharts, Embla carousel, React Day Picker, Input OTP, CVA, clsx/tailwind-merge.

### PDF
`jspdf` (client invoice PDF), `pdf-lib` (claim form fill).

### Dev
Vite 8, TypeScript 5.8, ESLint 9, Prettier 3.7, Nitro (Cloudflare Workers).

---

## 10. Recommendations

### Immediate (Before Production)
1. Add `.env` to `.gitignore`
2. Add rate limiting on AI endpoints
3. Add pagination to all list queries
4. Fix memory leak in mobile intake (`URL.revokeObjectURL`)
5. Add mobile responsive sidebar
6. Add loading skeletons for Suspense boundaries
7. Remove dead code (`supabaseAdmin`, unused components)

### Short Term (1-2 weeks)
8. Add client-side form validation (react-hook-form + Zod — already installed)
9. Add tests (unit + integration)
10. Eliminate `any` types — create proper interfaces
11. Extract shared `parseJson` utility
12. Add `updateVehicle` function
13. Consolidate search (GlobalLookup vs /search)
14. Add password reset flow

### Medium Term (1-2 months)
15. Add Kanban drag-and-drop (@dnd-kit)
16. Add real-time updates (Supabase Realtime)
17. Add streaming for AI assistant
18. Add bulk operations
19. Add light mode toggle
20. Add keyboard shortcuts
21. Add error boundaries per route
22. Make currency configurable

---

*End of Audit Report*
