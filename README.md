<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-React%2019-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Stack-TanStack%20Start-DC2626?style=flat-square" alt="TanStack">
  <img src="https://img.shields.io/badge/DB-Supabase-3FCF8E?style=flat-square&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/AI-Gemini%20Flash-4285F4?style=flat-square&logo=google" alt="Gemini">
  <img src="https://img.shields.io/badge/UI-shadcn%2Fui-000?style=flat-square" alt="shadcn">
</p>

<h1 align="center">Garage IQ</h1>

<p align="center">
  AI-powered garage management for car repair and insurance workflows.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#database">Database</a> ·
  <a href="#ai-pipeline">AI Pipeline</a>
</p>

---

## Features

### Core Operations
- **Dashboard** — Live KPIs: jobs by status, review queue, unpaid invoices, flagged jobs
- **Work Orders** — Kanban and table views, status tracking with full audit trail
- **Quick Intake** — Mobile-optimized 6-step wizard with VIN/plate OCR via AI camera
- **Today Board** — Daily floor view with outstanding payments and call actions

### Records
- **Customers** — List, create, view with linked vehicles and jobs
- **Vehicles** — List, create, full history (jobs, documents, claims, invoices)
- **Documents** — Upload, process, filter, archive. Dual mode: live intake + historical backfill

### AI-Powered Intelligence
- **Document AI Pipeline** — Classify, extract, and link documents automatically
  - Invoices, insurance docs, purchase orders, release forms, receipts
  - Confidence thresholds: auto-approve (≥90%), flag for review (70-90%), manual (<70%)
- **AI Assistant** — Natural-language queries across your garage data (read-only NL→SQL)
- **VIN/Plate OCR** — Extract VIN, license plate, odometer from photos
- **VIN Decoder** — Free NHTSA API integration for vehicle details

### Insurance & Finance
- **Insurance Claims** — Track claims with status management (pending/approved/denied/partial)
- **Claim Templates** — Upload blank PDF forms, map fields to garage data, auto-fill future claims
- **Invoices** — Track payment status, mark paid, PDF generation
- **Payment Ledger** — Per-job payment tracking with add/delete

### Workflow
- **Job State Machine** — Enforced transitions: pending → awaiting_insurance → parts_ordered → in_progress → awaiting_payment → completed
- **Review Queue** — Documents flagged for human review with resolution
- **Global Search** — Full-text search across all entities
- **Exports** — CSV/JSON export per entity

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [TanStack Start](https://tanstack.com/start) (full-stack SSR) |
| **Router** | [TanStack Router](https://tanstack.com/router) (file-based) |
| **UI** | React 19 + [shadcn/ui](https://ui.shadcn.com) (New York style) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) (OKLCH palette) |
| **Database** | [Supabase](https://supabase.com) (Postgres + RLS + Storage) |
| **Auth** | Supabase Auth (email/password + Google OAuth) |
| **AI** | [Vercel AI SDK](https://sdk.vercel.ai) → Google Gemini Flash |
| **State** | [TanStack React Query](https://tanstack.com/query) |
| **Forms** | React Hook Form + Zod validation |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **PDF** | jsPDF (client) + pdf-lib (claim forms) |
| **Build** | [Vite](https://vitejs.dev) 8 + Nitro (Cloudflare Workers) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) 18+ or [Bun](https://bun.sh)
- [Supabase](https://supabase.com) project (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/Thatisshayan/Garage-IQ.git
cd Garage-IQ
bun install
```

### 2. Environment Variables

Create a `.env` file (see `.env.example` for all variables):

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key
```

### 3. Database Setup

Run the migrations in your Supabase dashboard (SQL Editor) in order:

```
supabase/migrations/
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 4. Storage Bucket

Create a private storage bucket named `workshop-documents` in your Supabase dashboard.

### 5. Run Development Server

```bash
bun run dev
```

The app will be available at `http://localhost:3000`.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (React)                    │
│  Routes → Server Functions → TanStack Query          │
└──────────────────────┬──────────────────────────────┘
                       │ Bearer Token (JWT)
┌──────────────────────▼──────────────────────────────┐
│                 Server (TanStack Start)              │
│  createServerFn + requireSupabaseAuth middleware     │
│  ├─ CRUD Functions (customers, vehicles, jobs...)   │
│  ├─ Document AI Pipeline (classify → extract → link)│
│  ├─ State Machine (enforced transitions + audit)    │
│  └─ AI Assistant (NL → structured query)            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│               Supabase (Postgres)                    │
│  Tables + RLS + Storage + Auth                       │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Server-first**: All mutations go through `createServerFn` — client never talks to Supabase directly for writes
- **RLS everywhere**: Row-level security on all tables, enforced at the database level
- **AI is non-blocking**: Core workflow works without AI; classification/extraction enhance but don't gate
- **State machine is audited**: Every status transition writes an event row with source, actor, and reason

---

## Testing

```bash
bun run test       # Run all tests
bun run test:watch # Watch mode
```

Tests live alongside source as `*.test.ts`:
- `src/lib/state-machine.test.ts` — exhaustive state machine transitions (53 tests)
- `src/lib/extract-schemas.test.ts` — payment validation + extraction schemas (16 tests)

---

## Security

See `SECURITY-DECISIONS.md` for detailed decisions on:
- CSRF posture (Bearer-only auth, no cookie sessions)
- RLS row isolation model (open question — pending product decision)

---

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `user_roles` | Admin/staff role assignment |
| `customers` | Customer records |
| `vehicles` | Vehicle records |
| `jobs` | Work orders |
| `insurance_claims` | Insurance claims |
| `documents` | Uploaded documents + extracted data |
| `invoices` | Invoices |
| `payments` | Payment ledger |
| `job_status_events` | Audit trail |
| `document_review_queue` | AI review queue |
| `claim_templates` | Reusable claim PDF templates |

### Job Status Flow

```
         ┌──────────────┐
         │   pending     │◄─────────────────────┐
         └──────┬───────┘                      │
                │ insurance_approved            │ insurance_denied
         ┌──────▼───────────┐                  │
         │ awaiting_insurance│                  │
         └──────┬───────────┘                  │
                │ po_linked                     │
         ┌──────▼───────────┐                  │
         │  parts_ordered   │                  │
         └──────┬───────────┘                  │
                │ release_linked                │
         ┌──────▼───────────┐                  │
         │   in_progress    │                  │
         └──────┬───────────┘                  │
                │ invoice_unpaid                │
         ┌──────▼───────────┐                  │
         │ awaiting_payment │                  │
         └──────┬───────────┘                  │
                │ invoice_paid                  │
         ┌──────▼───────────┐                  │
         │    completed     │──────────────────┘
         └──────────────────┘
```

---

## AI Pipeline

### Document Processing

1. **Upload** → File stored in Supabase Storage (private bucket)
2. **Classify** → Gemini vision reads document, determines type with confidence score
3. **Extract** → Type-specific Zod schemas pull structured data (line items, amounts, dates, etc.)
4. **Link** → Rule-based matching: VIN→vehicle, name→customer, job context
5. **Side Effects** → Auto-create claims, invoices, trigger state machine transitions
6. **Review** → Low-confidence or ambiguous documents go to review queue

### Confidence Thresholds

| Score | Action |
|-------|--------|
| ≥ 0.90 | Auto-approve and link |
| 0.70 – 0.89 | Flag for human review |
| < 0.70 | Mark as unclassified |

### AI Assistant

The assistant translates natural language to structured Supabase queries:

- **Read-only** — Only generates SELECT queries
- **Table allowlist** — Only queries allowed tables
- **Column validation** — Column names checked against schema
- **Safe operators** — Filter operations restricted to safe functions

Example queries:
- "Jobs awaiting insurance"
- "Unpaid invoices over $1000"
- "Documents in review queue"
- "Customers with more than 3 vehicles"

---

## Project Structure

```
src/
├── routes/                     # File-based routing
│   ├── __root.tsx              # Root shell, meta, error boundaries
│   ├── auth.tsx                # Login/signup page
│   └── _authenticated/         # Auth-guarded routes
│       ├── route.tsx           # Sidebar layout + auth gate
│       ├── index.tsx           # Dashboard
│       ├── today/              # Daily floor view
│       ├── jobs/               # Work orders
│       ├── customers/          # Customer management
│       ├── vehicles/           # Vehicle management
│       ├── documents/          # Document library
│       ├── review-queue/       # AI review queue
│       ├── claims/             # Insurance claims
│       ├── invoices/           # Invoice management
│       ├── search/             # Global search
│       ├── assistant/          # AI assistant
│       └── m/                  # Mobile intake
├── lib/                        # Server functions
│   ├── *.functions.ts          # CRUD + business logic
│   ├── *.server.ts             # Server-only modules
│   └── utils.ts                # Helpers
├── integrations/
│   └── supabase/               # Database client + types
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── global-lookup.tsx       # Cmd+K search
│   └── motion-primitives.tsx   # Animation helpers
└── styles.css                  # Tailwind + theme
```

---

## Scripts

```bash
bun run dev        # Start development server
bun run build      # Production build
bun run preview    # Preview production build
bun run test       # Run Vitest tests
bun run test:watch # Run tests in watch mode
bun run lint       # Run ESLint
bun run format     # Format with Prettier
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | Yes |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI key (Gemini Flash) | Yes |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT

---

<p align="center">
  Built with AI. Powered by garage logic.
</p>
