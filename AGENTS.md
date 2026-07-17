# Garage IQ — Agent Rules

This file is the first-stop instruction set for any agent working in this repository.

## Mandatory Read Order

Before planning, editing, or reporting completion, every agent must read:

1. **[Baseline Rules](#baseline)** — Foundational agent rules (adapted from RemoteCliControl)
2. [README.md](./README.md) — Development setup and commands
3. [SECURITY-DECISIONS.md](./SECURITY-DECISIONS.md) — Security posture documentation
4. `.env.example` — All required environment variables
5. The GARAGEIQ-specific conventions below

## Baseline

All repositories follow the foundational agent rules established in the RemoteCliControl project:

- Keep docs findable and current while work is in progress
- Do not claim completion without verification
- Do not silently skip requested steps
- Record deferred work in appropriate documentation
- Keep the repo stable, review existing failures, and report what was pre-existing
- Code changes must be actually applied and tested
- Documentation must be updated in the same pass as code changes
- Verification must be run (or concrete blockers reported)

For full details, see [RemoteCliControl/AGENTS.md](../RemoteCliControl/AGENTS.md).

## Garage IQ-Specific Context

**Project**: AI-powered garage management for car repair and insurance workflows

**Tech Stack**: Nuxt3 SSR, Bun, Vite, state machines, extraction schemas

**Key Traits**:
- Financial/payment-critical operations (high correctness requirement)
- Business logic expressed as state machines (extensible, testable)
- AI extraction pipeline with Zod validation
- Rate limiting and error handling conventions (see below)

---

# Garage IQ

## Development

```bash
bun install
bun run dev
```

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start dev server (Vite + HMR) |
| `bun run build` | Production build (client + SSR + Nitro) |
| `bun run test` | Run Vitest tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run lint` | ESLint check |

## Environment Variables

See `.env.example` for required variables.

## Error Handling Convention

Server functions (`src/lib/*.functions.ts`) use **throw on error**:

```typescript
if (error) throw new Error(error.message);
```

Two exceptions use `return { error }` for user-facing messages:
- Rate limiters (intake, assistant) — return a friendly string, not an exception
- AI assistant — returns structured error info alongside the raw plan

All callers catch with `try/catch` and show errors via `toast.error()`.

## Testing

Tests live alongside source as `*.test.ts`. Currently:
- `src/lib/state-machine.test.ts` — exhaustive state machine transitions
- `src/lib/extract-schemas.test.ts` — payment validation + extraction schemas

Run with `bun run test`.

## Security

See `SECURITY-DECISIONS.md` for CSRF posture and RLS isolation model decisions.

## Lint / TypeScript `any` Policy

`bun run lint` currently reports ~126 `@typescript-eslint/no-explicit-any` warnings. These are a **permanent baseline**, not a reduction target.

**Why:** The remaining `any` occurrences fall into two categories:
1. **Genuinely dynamic AI/SDK shapes** — AI assistant filter values, SDK content-type casts, extraction pipeline outputs where the schema is validated at runtime via Zod
2. **Legacy props in UI components** — already-typed where it matters (money path, extraction schemas), cosmetic elsewhere

**Rule:** New code should avoid adding `any`. If a new `any` is genuinely needed (dynamic AI response, SDK type gap), add it with a one-line reason comment. The lint rule stays at `warn` — CI passes but the count is visible. If the count grows above 150, triage the delta before adding more.
