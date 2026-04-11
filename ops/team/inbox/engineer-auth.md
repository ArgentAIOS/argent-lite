# Task 009 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: obs-metrics
Branch: codex/obs-metrics (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/obs/metrics.ts
- tests/obs/metrics.test.ts

## Goal

Phase 3 observability **metrics** layer.

1. `src/obs/metrics.ts`:
   ```ts
   export interface Metrics {
     inc(name: string, labels?: Record<string, string>, by?: number): void;
     observe(name: string, value: number, labels?: Record<string, string>): void;
     snapshot(): MetricsSnapshot;
   }
   export interface MetricsSnapshot {
     counters: Array<{ name: string; labels: Record<string, string>; value: number }>;
     histograms: Array<{ name: string; labels: Record<string, string>; count: number; sum: number; p50: number; p95: number; p99: number }>;
   }
   export function createMetrics(): Metrics;
   ```
   - Counters: monotonic, keyed by `name + labels`.
   - Histograms: store observations in a bounded ring (cap 1024 per series), compute p50/p95/p99 at snapshot time via sort.
   - Labels order-insensitive when keying — sort keys before hashing.
   - Pure JS — no perf_hooks assumptions.
2. `tests/obs/metrics.test.ts`:
   - `inc` twice with same labels → counter value = 2
   - `inc` with same name + different labels → two separate counters
   - `observe` 100 values → histogram.count=100, sum correct, p50/p95/p99 sane
   - Labels `{a:"1",b:"2"}` and `{b:"2",a:"1"}` hash to same series
   - Bounded ring: observing 2000 values still gives 1024-sample percentiles

## Constraints

- Node built-ins only.
- Do NOT touch other subsystems.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
