# Task 019 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: router-circuit-breaker
Branch: codex/router-circuit-breaker (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/router/circuit-breaker.ts
- tests/router/circuit-breaker.test.ts

## Goal

Per-provider circuit breaker. When a provider fails N times in a
row, open the circuit for T seconds — `route()` skips that provider
during the open window.

1. `src/router/circuit-breaker.ts`:
   ```ts
   export interface CircuitBreakerOptions {
     inner: Router;
     threshold: number;        // failures before opening, default 5
     cooldownMs: number;       // open window, default 30000
     now?: () => number;
   }
   export function withCircuitBreaker(opts: CircuitBreakerOptions): Router;
   ```
   - Tracks per-provider failure counts keyed by `providerId`.
   - On success → reset count to 0.
   - On failure → increment; if >= threshold, open (record `openedAt`).
   - On `route()` — if a provider is open and `now() - openedAt < cooldownMs`,
     treat it as unavailable so the policy falls through.
   - After cooldown, half-open: next call gets one try; success closes,
     failure re-opens.
   - Delegation: keep internal state only; never mutate inner router.
2. `tests/router/circuit-breaker.test.ts`:
   - Fake inner with injectable failure sequence.
   - 5 failures → circuit opens, 6th is skipped.
   - Cooldown passes (injected clock) → half-open, 1 try.
   - Success in half-open → closed.
   - Failure in half-open → re-open.

## Constraints

- Do NOT touch ModelRouter or existing wrappers.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
