# Task 009 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: router-metrics-wiring
Branch: codex/router-metrics-wiring (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/router/instrumented-router.ts
- tests/router/instrumented-router.test.ts

## Goal

Wrap `ModelRouter` with a thin instrumentation layer that increments
metrics and logs each route call. No changes to ModelRouter itself.

1. `src/router/instrumented-router.ts`:
   ```ts
   export interface InstrumentOptions {
     inner: Router;
     metrics?: Metrics;
     logger?: Logger;
     now?: () => number;
   }
   export function instrumentRouter(opts: InstrumentOptions): Router;
   ```
   - Returned Router delegates `route(req)` and `register(p)` to `inner`.
   - On `route()`:
     - `metrics.inc("router.route.total", { policy: "unknown" })` before
     - Time via `now()` around the call
     - `metrics.observe("router.route.latency_ms", duration, { ok: success ? "true" : "false" })`
     - `metrics.inc("router.route.success"|"router.route.failure")`
     - `logger.info("router.route", { duration_ms, ok, provider: res.providerId? })`
2. `tests/router/instrumented-router.test.ts`:
   - Inject a fake `inner` that returns a canned response; verify counters + histogram.
   - Inject a fake `inner` that throws; verify failure counter + logger.error.
   - Verify delegation: `register(p)` reaches the inner.

## Constraints

- Do NOT touch ModelRouter, existing router files, or agents.
- Do NOT import `src/obs/**` runtime — take `Metrics` / `Logger` as
  injected options (interface-only imports via `import type`). This keeps
  the router decoupled from observability impl.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
