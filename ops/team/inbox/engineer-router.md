# Task 011 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: memory-observed-router
Branch: codex/memory-observed-router (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/router/memory-router.ts
- tests/router/memory-router.test.ts

## Goal

A router wrapper that persists every route call to a `MemoryStore` as
an event, so the system has a complete audit trail of LLM traffic.

1. `src/router/memory-router.ts`:
   ```ts
   export interface MemoryRouterOptions {
     inner: Router;
     memory: MemoryStore;  // injected
     agentId?: string;     // default "router"
     now?: () => number;
   }
   export function withMemoryLog(opts: MemoryRouterOptions): Router;
   ```
   - Delegates `register(p)` and `route(req)` to inner.
   - On each `route()`, after success, calls
     `memory.append(agentId, {id, ts, kind: "router.route", payload: {req, providerId, model}})`.
   - On failure, appends `{kind: "router.error", payload: {req, error: msg}}`.
   - Memory errors must NOT break routing — swallow + swallow log via
     an optional injected `logger` (interface import only).
2. `tests/router/memory-router.test.ts`:
   - Mock `inner` returning a canned response; mock `memory` as object
     with `append = vi.fn()`. Verify append called with right shape.
   - Mock `inner` that throws; verify error event appended.
   - Mock `memory.append` that throws; verify routing still succeeds
     (swallowed).

## Constraints

- `import type` for `MemoryStore` from `../memory/types.js`.
- Do NOT touch ModelRouter, instrumented-router, memory/**, etc.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
