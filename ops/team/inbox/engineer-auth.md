# Task 008 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: memory-retention
Branch: codex/memory-retention (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/memory/retention.ts
- tests/memory/retention.test.ts

## Context

`SqliteMemoryStore` landed in cycle-7 (PR #21). The design doc
(`ops/projects/memory-lite-design.md`) also requires: TTL per key,
event log cap per agent. Implement those as a **retention layer** that
wraps a `MemoryStore` — do NOT edit `sqlite-store.ts`.

## Goal

1. **`src/memory/retention.ts`** — exports:
   ```ts
   export interface RetentionOptions {
     keyTtlMs?: number;                 // default: unlimited
     maxEventsPerAgent?: number;        // default: 1000
     now?: () => number;
   }
   export function withRetention(store: MemoryStore, opts?: RetentionOptions): MemoryStore;
   ```
   - `set(agent, key, value)` records the write time internally; the
     wrapped `get` returns `undefined` (and evicts) if the key is older
     than `keyTtlMs`.
   - `append(agent, event)` prunes to the newest `maxEventsPerAgent`
     after each append (call inner `query` to count, inner `close`
     only on close).
   - `list` filters out expired keys.
2. **`tests/memory/retention.test.ts`** — uses an in-memory fake
   `MemoryStore` (no sqlite dep) to verify: TTL expires, `list` hides
   expired, event cap enforces at write time, non-expired keys survive.

## Constraints

- Do NOT touch `src/memory/sqlite-store.ts`, `types.ts`, `index.ts`,
  or `store.ts`.
- Do NOT add deps.
- Strict TS, no `any`.

## Acceptance criterion

- 2 files.
- `pnpm check` + `pnpm test tests/memory/retention.test.ts` pass.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
