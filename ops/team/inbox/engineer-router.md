# Task 010 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: agent-trace-context
Branch: codex/agent-trace-context (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/agents/trace-context.ts
- tests/agents/trace-context.test.ts

## Goal

Trace ID propagation across channel → bus → agent → router.

1. `src/agents/trace-context.ts`:
   - `newTraceId(): string` — 16-byte hex random via `node:crypto.randomBytes`.
   - `TRACE_HEADER = "trace_id"`.
   - `getTraceId(msg: AgentMessage): string | undefined` — reads `msg.payload` if payload is an object with a `trace_id` string, otherwise undefined.
   - `stampTrace<T extends object>(payload: T, traceId: string): T & { trace_id: string }`.
   - `withTracedRoute(router, now?)` — returns a wrapped `Router` whose
     `route(req)` accepts an optional `traceId`, logs via a provided
     `Logger` interface (injected, optional), and adds a
     `x-argent-trace-id` header to the request (no change to router, just pass-through).
     Actually: since we don't want to modify router signatures, keep
     this function minimal — just expose the helpers; the wiring happens
     in a later slice.
2. `tests/agents/trace-context.test.ts`:
   - `newTraceId()` returns 32 hex chars, unique across calls
   - `stampTrace` adds the field without mutating input
   - `getTraceId` returns the id if present, undefined if not, undefined if malformed
   - 100 trace IDs → all unique

## Constraints

- Do NOT touch router, bus, agents base files.
- Node built-ins only.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
