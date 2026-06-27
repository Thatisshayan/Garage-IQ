
# AI-Powered Workshop Management System

Build the full spec on the existing TanStack Start stack with Lovable Cloud (Postgres + Storage + Auth) and Lovable AI Gateway for classification/extraction/assistant.

## 1. Backend (Lovable Cloud)

Enable Cloud, then create migrations for the full data model + audit/state-machine support.

Tables (public schema, RLS on, GRANTs to authenticated + service_role):
- `customers` — id, name, email, phone, address, timestamps
- `vehicles` — id, customer_id FK, make, model, year, vin, license_plate, color, created_at
- `jobs` — id, customer_id FK, vehicle_id FK, description, status (enum), assigned_to, timestamps
- `insurance_claims` — id, job_id FK, claim_number, insurer, policy_number, status (enum), approved_amount, timestamps
- `documents` — id, job_id FK nullable, customer_id FK nullable, vehicle_id FK nullable, type (enum), file_url, file_name, mime_type, size_bytes, extracted_data JSONB, confidence_score numeric, processing_status (enum), uploaded_by, created_at
- `invoices` — id, document_id FK, job_id FK, amount, tax, total, currency, payment_status (enum), due_date, paid_at, created_at
- `job_status_events` — id, job_id FK, from_status, to_status, trigger (event|manual|ai), source_document_id FK nullable, reason, actor_id, created_at (full audit trail)
- `document_review_queue` — id, document_id FK, reason (unclassified|low_confidence|multi_match|no_match|conflict), resolved_at, resolved_by
- `user_roles` (admin/staff) per security rules — separate table + `has_role()` SECURITY DEFINER

Enums: `job_status` (pending, awaiting_insurance, parts_ordered, in_progress, awaiting_payment, completed), `doc_type`, `doc_processing_status`, `claim_status`, `payment_status`, `app_role`.

Storage bucket: `workshop-documents` (private) for uploaded files; signed URLs for access.

Full-text search: tsvector columns + GIN indexes on jobs.description, customers.name, vehicles.vin/plate, documents.extracted_data + OCR text.

## 2. Document Intelligence Pipeline

Async, non-blocking (core flow works without AI).

- Upload via drag-drop → file to Storage → insert `documents` row (processing_status=pending) → fire-and-forget call to server function `processDocument`.
- `processDocument` server fn:
  1. OCR via Lovable AI Gateway (`google/gemini-3-flash-preview` vision on the file/image, PDF pages rendered if needed).
  2. Classify: LLM with structured Output (zod) → {type, confidence}. ≥0.9 auto, 0.7–0.9 flag review, <0.7 unclassified.
  3. Extract: per-type zod schema (invoice/insurance/PO/release/receipt). Stored in `extracted_data` JSONB with per-field confidence.
  4. Link: rule-based match (VIN→vehicle, email/phone→customer, job context). Single match → auto-link; else enqueue review.
  5. Update processing_status; insert `document_review_queue` row when needed.
  6. Trigger state machine evaluation for linked job.

## 3. Job State Machine

`evaluateJobStatus(jobId, event)` server fn enforces the transition table from the spec. Every transition writes a `job_status_events` row with source doc + actor + reason. Manual admin overrides require a reason string and admin role check (`has_role`).

Triggers:
- Insurance doc extracted approved → awaiting_insurance
- PO linked → parts_ordered
- Release/completion form linked → in_progress
- Unpaid invoice uploaded → awaiting_payment
- Paid invoice extracted → completed
- Insurance denied → pending + flag

## 4. Server Functions (TanStack `createServerFn`)

Auth-protected via `requireSupabaseAuth`:
- Customers/Vehicles/Jobs/Claims/Invoices CRUD
- `uploadDocument`, `processDocument`, `relinkDocument`, `overrideDocumentType`, `editExtractedData`
- `transitionJob`, `overrideJobStatus`
- `searchAll(query, filters)` — full-text across all entities
- `aiAssistantQuery(question)` — read-only NL→SQL via LLM with strict allowlist (SELECT only, whitelisted tables, parameterized, server-executed); returns rows + generated explanation
- `exportEntity(type, format)` — CSV/JSON export

Public server route: none required (all in-app).

## 5. Frontend (TanStack routes under `_authenticated`)

- `/auth` — email/password + Google sign-in
- `/` — dashboard: KPIs (jobs by status, review queue size, unpaid invoices, claims pending), recent activity
- `/jobs` — kanban + table toggle, filter by status/assignee
- `/jobs/$jobId` — detail: customer, vehicle, claim, documents, status timeline, manual transition w/ reason
- `/customers`, `/customers/$id` — list + detail with vehicles + jobs
- `/vehicles`, `/vehicles/$id`
- `/documents` — library with filters (type/date/status), drag-drop upload zone
- `/documents/$id` — file preview + editable extracted_data form + manual link UI
- `/review-queue` — uncertain documents needing human action
- `/claims` — insurance claims list
- `/invoices` — invoices with payment status
- `/search?q=` — global full-text results page (also a header search box w/ instant results)
- `/assistant` — chat UI for NL queries (read-only)
- `/settings` — users, roles, exports

Components: shadcn/ui (existing), react-markdown for assistant, kanban via dnd-kit, tanstack-table for tables.

## 6. AI Integration

- Provider: Lovable AI Gateway via `@ai-sdk/openai-compatible`, server-only helper.
- Models: `google/gemini-3-flash-preview` for OCR/classification/extraction/assistant.
- Structured output via `Output.object({ schema: zod })`.
- Assistant uses tool-calling with a single `run_select_query` tool whose handler validates the SQL against an allowlist before executing on the server publishable client.

## 7. Security

- RLS on all tables; staff role sees all workshop data, customers limited to own (if customer accounts later — for now staff-only app).
- `user_roles` table + `has_role()`; admin required for status overrides and AI assistant SQL execution.
- Signed URLs for document downloads; bucket private.
- Input validation with zod on every server fn.

## 8. Design

Dark, dense operations UI (workshop tool, not consumer app). Neutral slate base with a single accent (amber) for status/CTA. Sidebar nav, status badges color-coded per state. Monospace for VINs/claim numbers.

## 9. Build Order

1. Enable Lovable Cloud + auth (email + Google) + user_roles
2. Migrations: enums, all tables, GRANTs, RLS policies, FTS indexes, storage bucket
3. Server fns: CRUD + state machine + audit log
4. Document upload + AI pipeline (classify/extract/link) + review queue
5. UI: auth, dashboard, jobs kanban, job detail, customers, vehicles
6. UI: document library, upload, review queue, document detail editor
7. Claims + invoices + payment flow
8. Global search + filters
9. AI assistant (read-only NL→SQL with tool allowlist)
10. Exports (CSV/JSON) per entity
11. QA pass: verify each state transition triggers and audit log writes

## Notes / Open Items

- Email-forward ingestion is mentioned in the spec; planned as a `/api/public/inbound-email` webhook stub (SendGrid/Postmark compatible). User will need to configure the email provider + webhook secret later — not blocking initial build.
- PDF rendering for multi-page OCR uses pdfjs in the server fn; if Worker runtime rejects native deps, fall back to sending the PDF directly to the multimodal model.

Confirm and I'll build it end-to-end.
