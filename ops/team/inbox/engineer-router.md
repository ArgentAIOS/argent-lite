# Task 004 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: hailo-provider-stub
Branch: codex/hailo-provider-stub (worktree /home/jason/code/argent-lite-router — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/providers/hailo.ts                    (create)
- src/providers/hailo-capabilities.ts       (create)
- tests/providers/hailo.test.ts             (create)
- src/router/health.ts                      (create)
- tests/router/health.test.ts               (create)

## Context

Phase 1 shipped three providers (ollama, anthropic, openai). The
Raspberry Pi AI HAT+ 2 with Hailo-10H arrives 2026-04-12 — we need a
provider stub ready so the router can swap in Hailo acceleration on
day one without touching the router code. Also: the router currently
has no health endpoint, so the CLI can't report which providers are
live.

## Goal

1. **`src/providers/hailo.ts`** — `HailoProvider` class implementing
   the `Provider` interface from `src/router/types.ts`.
   - `id: "hailo"`, `kind: "local"`.
   - Constructor: `{ modelPath: string, socketPath?: string }`.
     Default `socketPath = "/var/run/hailort.sock"`.
   - `complete(req)` → for now, throws
     `HailoUnavailableError("HailoProvider: Hailo-10H not yet
     initialized")`. This is the stub. The error is typed so the
     router can catch and fall through.
   - `healthCheck()` → returns `false` until a real implementation
     lands.
   - Export `HailoUnavailableError`.
2. **`src/providers/hailo-capabilities.ts`** — exports a static
   capability map: a `const HAILO_MODELS: Record<string, { contextLen:
   number; quant: string; source: string }>` listing the GenAI Model
   Zoo `.hef` models we expect to support (e.g. `llama3-8b-q4`,
   `gemma2-2b-q4`). Source: reference the Pudding Entertainment guide
   URL as a comment. No runtime behavior.
3. **`src/router/health.ts`** — `routerHealth(router)` function that
   calls `healthCheck()` on every registered provider in parallel and
   returns `{ providerId, healthy, latencyMs }[]`. Pure-ish — takes a
   clock function as an optional arg for test injection.
4. **Tests:**
   - `tests/providers/hailo.test.ts`: asserts `complete()` throws
     `HailoUnavailableError`, `healthCheck()` returns false,
     `id === "hailo"`, `kind === "local"`.
   - `tests/router/health.test.ts`: registers two mock providers (one
     healthy, one throwing), asserts `routerHealth` returns both with
     correct `healthy` flags and measured `latencyMs`.

## Constraints

- Do NOT touch `src/auth/**`, `src/cli/**`, `src/config/**`,
  `src/satellite/**` (engineer-auth's cycle-4 slice).
- Do NOT add dependencies.
- Strict TypeScript. ESM. `.js` specifiers.
- Do NOT import real `hailo` or `hailort` packages — none are on the
  npm registry and the hardware isn't live yet.

## Acceptance criterion

- All 5 files exist.
- Tests have real assertions.
- `ops/team/outbox/engineer-router.md` has confirmation line, files
  touched, line counts.

## Validation commands

- `ls src/providers/hailo* src/router/health.ts tests/providers/hailo.test.ts tests/router/health.test.ts`
- `wc -l src/providers/hailo*.ts src/router/health.ts tests/providers/hailo.test.ts tests/router/health.test.ts`

## Deadline

Before the next cron tick.
