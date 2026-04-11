# Task 019 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: memory-encryption
Branch: codex/memory-encryption (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/memory/encrypted.ts
- tests/memory/encrypted.test.ts

## Goal

Encryption wrapper for `MemoryStore`. Every `value_json` and
`payload_json` is AES-256-GCM encrypted at set/append time and
decrypted at get/query time. Key comes from an injected secret.

1. `src/memory/encrypted.ts`:
   ```ts
   export interface EncryptedMemoryOptions {
     inner: MemoryStore;
     secret: string;   // ≥32 bytes recommended
   }
   export function withEncryption(opts: EncryptedMemoryOptions): MemoryStore;
   ```
   - Wraps an inner store; encrypts outgoing values, decrypts incoming.
   - Uses `crypto.randomBytes(12)` for each IV; stores `{iv, tag, ciphertext}` as JSON.
   - `list()` passes through (keys are unencrypted).
   - Errors during decryption are rethrown as `MemoryDecryptError`.
2. `tests/memory/encrypted.test.ts`:
   - In-memory fake inner store.
   - Round-trip set/get — same value out.
   - On-disk (fake) value is NOT plaintext.
   - Wrong secret throws.
   - `append`/`query` round-trip with multiple events.

## Constraints

- Node built-ins only (`node:crypto`).
- Do NOT touch existing `src/memory/**` files. New file only.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
