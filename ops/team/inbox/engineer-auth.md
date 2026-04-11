# Task 017 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: credential-rotation
Branch: codex/credential-rotation (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/auth/rotation.ts
- tests/auth/rotation.test.ts

## Goal

Add credential rotation support to the `CredentialStore` interface.

1. **`src/auth/rotation.ts`**:
   ```ts
   export interface RotationOptions {
     inner: CredentialStore;
     now?: () => number;
     maxAgeMs?: number;   // default 30 days
   }
   export interface RotatingCredentialStore extends CredentialStore {
     lastRotated(providerId: string): Promise<number | undefined>;
     stale(providerId: string, maxAgeMs?: number): Promise<boolean>;
     markRotated(providerId: string): Promise<void>;
   }
   export function withRotation(opts: RotationOptions): RotatingCredentialStore;
   ```
   - Wraps an existing store, layers a rotation timestamp on top.
   - Timestamps are stored as `${providerId}:rotated-at` keys via the
     inner store's `set`/`get` so persistence is automatic.
   - `stale()` returns true if no rotation timestamp exists or if
     `now() - lastRotated > maxAgeMs`.
2. **`tests/auth/rotation.test.ts`**:
   - Start with an in-memory fake `CredentialStore` (build a minimal
     one in the test file; do NOT touch src/auth/**).
   - `set(provider, secret)` → rotation timestamp exists afterward.
   - `stale()` returns true for a provider never rotated.
   - `stale()` returns false immediately after rotation.
   - `stale()` returns true after simulated time passes via injected `now`.
   - `markRotated()` resets the timestamp.

## Constraints

- Do NOT touch existing `src/auth/**` files. Add only `rotation.ts`.
- Node built-ins only.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
