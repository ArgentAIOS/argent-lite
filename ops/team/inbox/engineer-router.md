# Task 018 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: router-rate-limit
Branch: codex/router-rate-limit (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/router/rate-limit.ts
- tests/router/rate-limit.test.ts

## Goal

Add a token-bucket rate limiter wrapper around `Router.route` so the
Pi doesn't hammer cloud providers.

1. **`src/router/rate-limit.ts`**:
   ```ts
   export interface RateLimitOptions {
     inner: Router;
     tokensPerSec: number;
     burst: number;           // bucket capacity
     now?: () => number;
   }
   export class RateLimitedError extends Error {
     readonly retryAfterMs: number;
     constructor(retryAfterMs: number);
   }
   export function withRateLimit(opts: RateLimitOptions): Router;
   ```
   - Token bucket refills at `tokensPerSec`, cap at `burst`.
   - `route()` tries to consume 1 token; if none, throws
     `RateLimitedError` with a computed `retryAfterMs`.
   - `register(p)` delegates untouched.
2. **`tests/router/rate-limit.test.ts`** — inject a fake `now`:
   - Burst of 3 → 3 successful routes, 4th throws.
   - After advancing time by `1000/tokensPerSec`, next call succeeds.
   - Sustained burst at exact rate never throws.
   - `retryAfterMs` is non-negative and decreasing as time advances.

## Constraints

- Do NOT touch existing router files.
- Pure functional clock via injected `now`.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
