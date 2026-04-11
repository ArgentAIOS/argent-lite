# Task 007 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: memory-store-impl
Branch: codex/memory-store-impl (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/memory/store.ts
- src/memory/sqlite-store.ts
- src/memory/types.ts
- src/memory/index.ts
- tests/memory/store.test.ts
- tests/memory/sqlite-store.test.ts

## Context

`ops/projects/memory-lite-design.md` (merged in cycle-6 as PR #17)
describes a per-agent SQLite KV store + append-only event log. Your
job is to implement it.

Node 22 ships a built-in `node:sqlite` module (currently experimental).
Use it. **Do not add better-sqlite3 or any other native dep.** If
`node:sqlite` is gated behind a flag, gate it behind a runtime check
and throw a clear error.

## Goal

1. **`src/memory/types.ts`** — interfaces:
   ```ts
   export interface MemoryStore {
     get(agentId: string, key: string): Promise<unknown>;
     set(agentId: string, key: string, value: unknown): Promise<void>;
     list(agentId: string): Promise<string[]>;
     append(agentId: string, event: MemoryEvent): Promise<void>;
     query(agentId: string, opts?: { limit?: number; sinceTs?: number }): Promise<MemoryEvent[]>;
     close(): Promise<void>;
   }
   export interface MemoryEvent {
     id: string;
     ts: number;
     kind: string;
     payload: unknown;
   }
   ```
2. **`src/memory/sqlite-store.ts`** — `SqliteMemoryStore` implementing
   `MemoryStore`:
   - Uses `node:sqlite` (import dynamically; if unavailable, throw
     `MemoryStoreError("node:sqlite is not available; run with --experimental-sqlite on older Node")`).
   - Schema: tables `kv(agent_id, key, value_json, updated_at)` PK
     `(agent_id, key)`; `events(id PK, agent_id, ts, kind, payload_json)`
     with index on `(agent_id, ts DESC)`.
   - Serializes writes via an internal async mutex (simple promise chain).
3. **`src/memory/store.ts`** — `createMemoryStore(opts: { path: string }): Promise<MemoryStore>` factory that opens the SQLite db and returns the store. Creates the schema on first open.
4. **`src/memory/index.ts`** — re-exports.
5. **Tests (vitest):**
   - `store.test.ts` — factory opens+closes, round-trip get/set, list, append+query. Uses a temp dir (`os.tmpdir()` + `fs.mkdtempSync`). If `node:sqlite` is unavailable the test should SKIP with a clear message, not fail.
   - `sqlite-store.test.ts` — direct test of SqliteMemoryStore with injection; covers schema creation and the async mutex (two concurrent writes don't corrupt state).

## Constraints

- No new dependencies in package.json.
- Node built-ins only.
- Strict TS, ESM `.js` specifiers, no `any`.
- Do NOT touch `src/auth/**`, `src/agents/**`, `src/router/**`, `src/providers/**`, `src/satellite/**`, `src/cli/**`, `src/scheduler/**`, `src/config/**`, `src/demo/**`.

## Acceptance criterion

- 6 files exist.
- `pnpm check` passes.
- `pnpm test tests/memory/` passes (tests may SKIP if node:sqlite absent).
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
