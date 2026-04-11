# Task 011 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: instrumented-cli
Branch: codex/instrumented-cli (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- src/cli/instrumented-main.ts
- tests/cli/instrumented-main.test.ts

## Goal

Wire cycle-9's `createLogger` + `createMetrics` + cycle-9's
`instrumentRouter` into a new CLI entrypoint that records every route
call.

1. `src/cli/instrumented-main.ts` — `instrumentedMain(argv, opts?)`:
   - Creates `createLogger({level: "info"})` and `createMetrics()`.
   - Creates the default router via `createDefaultRouter({credentials})`.
   - Wraps it with `instrumentRouter({ inner: router, metrics, logger })`.
   - Reads the prompt from argv, routes it, prints result to stdout.
   - On exit, logs a final line with `metrics.snapshot()` summary
     (just counts + p50/p95 for router.route.latency_ms).
   - Returns a numeric exit code.
2. `tests/cli/instrumented-main.test.ts` — inject a mock router via an
   optional `routerOverride` option so tests don't hit network. Assert
   the logger captured a "router.route" line and metrics recorded 1
   success counter.

## Constraints

- Do NOT touch `src/cli/index.ts` — this is a separate entrypoint.
- Inject logger/metrics/router for tests.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
