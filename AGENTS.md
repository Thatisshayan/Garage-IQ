# Garage IQ

AI-powered garage management for car repair and insurance workflows.

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
