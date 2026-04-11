# Task 016 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: memory-telemetry
Branch: codex/memory-telemetry (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/memory/telemetry.ts
- tests/memory/telemetry.test.ts

## Goal

Add telemetry wrapping for `MemoryStore` that records counters +
latency histograms on every operation.

1. `src/memory/telemetry.ts`:
   ```ts
   export interface MemoryTelemetryOptions {
     inner: MemoryStore;
     metrics: Metrics;    // injected, interface-only import
     logger?: Logger;     // optional
     now?: () => number;
   }
   export function withTelemetry(opts: MemoryTelemetryOptions): MemoryStore;
   ```
   - Returns a MemoryStore wrapper.
   - Every method increments `memory.op.total` with a `op` label
     (get/set/list/append/query/close).
   - Every method observes `memory.op.latency_ms` with the same `op` label.
   - On error: `memory.op.errors` counter, plus `logger.error("memory.op.error", ...)` if logger provided.
   - All events flow through — never swallow errors, always rethrow.
2. `tests/memory/telemetry.test.ts`:
   - Wrap an in-memory fake MemoryStore.
   - Call each method, assert counters/histograms via
     `metrics.snapshot()`.
   - Verify error propagation: inner throws → telemetry wrapper
     counts error + rethrows.
   - Verify close() increments + is idempotent.

## Constraints

- `import type` for `MemoryStore`, `Metrics`, `Logger`.
- Do NOT touch `src/memory/**` other than the new file.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
