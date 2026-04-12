# Memory Lite Design — Phase 3 Gate Planning Doc

**Status:** planning-complete · **Slice:** `memory-lite-design` ·
**Branch:** `codex/memory-lite-design` · **Owner:** architect ·
**Parent:** `ops/projects/agent-topology-lite.md` ·
**Consumers:** engineer slices `memory-store-impl`, `memory-retention`,
`memory-telemetry`, then downstream `intent-routing-lite`, `channels-lite`.

## 1. Decision summary

Argent Lite ships **one** memory subsystem: a SQLite-backed per-agent
key-value store plus an append-only event log, behind a single
`MemoryStore` interface. No Postgres, no Redis, no in-process upgrade
path — the Pi 5 runs one writer and SQLite WAL is the durability
ceiling. Writes serialize through an async mutex so all agents share one
DB file without corrupting the log.

## 2. Scope and non-goals

**In scope:** schema, interface contract, retention, serialization, telemetry counters, phased slice breakdown.
**Non-goals:** distributed memory, vector/semantic recall, cross-agent shared state, Postgres migration, satellite-mode memory sync (deferred; Phase 3 is local-only).

## 3. Data model

One SQLite file at `${ARGENT_HOME}/memory.sqlite` (WAL, `synchronous=NORMAL`).

```sql
CREATE TABLE kv (
  agent_id   TEXT    NOT NULL,
  key        TEXT    NOT NULL,
  value_json TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,          -- epoch ms
  expires_at INTEGER,                   -- nullable; per-key TTL
  PRIMARY KEY (agent_id, key)
);
CREATE INDEX kv_by_agent_updated ON kv(agent_id, updated_at DESC);

CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT    NOT NULL,
  ts           INTEGER NOT NULL,        -- epoch ms
  kind         TEXT    NOT NULL,
  payload_json TEXT    NOT NULL
);
CREATE INDEX events_by_agent_ts ON events(agent_id, ts DESC);
```

Composite PK on `kv` makes `get/set` O(log n); `kv_by_agent_updated` serves `list()` pagination. `events` is append-only; its index covers `query()` time-range scans. No FKs — agents are logical IDs owned by the scheduler.

## 4. API surface (`src/memory/**`)

```ts
type AgentId = string;
interface MemoryRecord<T = unknown> {
  key: string; value: T; updatedAt: number; expiresAt?: number;
}
interface MemoryEvent<T = unknown> {
  id: number; ts: number; kind: string; payload: T;
}
interface ListOpts  { prefix?: string; limit?: number; cursor?: string; }
interface QueryOpts { kind?: string; since?: number; until?: number; limit?: number; }

interface MemoryStore {
  get<T>(agentId: AgentId, key: string): Promise<MemoryRecord<T> | null>;
  set<T>(agentId: AgentId, key: string, value: T, ttlMs?: number): Promise<void>;
  list(agentId: AgentId, opts?: ListOpts): Promise<MemoryRecord[]>;
  append<T>(agentId: AgentId, kind: string, payload: T): Promise<MemoryEvent<T>>;
  query<T>(agentId: AgentId, opts?: QueryOpts): Promise<MemoryEvent<T>[]>;
  close(): Promise<void>;
}
```

The scheduler injects one `MemoryStore` into `AgentContext` as `ctx.memory`; scoping is by the `agentId` argument. A `ScopedMemory` wrapper may hide the ID later; not in Phase 3.

## 5. Retention policy

- **TTL per key:** `set()` takes `ttlMs` → `expires_at = now + ttlMs`. Lazy sweeper deletes expired rows on `get`/`list`; a periodic job (10 min) purges the rest.
- **Event-log cap per agent:** hard ceiling **10 000 events/agent** (override `ARGENT_MEMORY_EVENT_CAP`). On `append()`, if count > cap, oldest N rows for that agent deleted in the same transaction (FIFO).
- **Global DB cap:** soft warn at 256 MB; hard fail `append()` at 512 MB with `MemoryFullError`. Operator decides raise-cap vs purge.

## 6. Concurrency

One SQLite connection, one async mutex. Writes (`set`, `append`, sweeper, cap enforcement) serialize through `withLock(async () => …)`. Reads also acquire the lock — simpler than shared-cache mode and the Pi's workload is write-light. Transactions stay short (<5 ms) and the mutex never spans a non-DB `await`. Contention above ~50 ops/s is an operator signal to move memory off-box, not a trigger to add tiers.

## 7. Phase 3 unblock requirements

Before `intent-routing-lite` or `channels-lite` can open:

1. `MemoryStore` interface merged in `src/memory/index.ts`.
2. `SqliteMemoryStore` passes the acceptance tests in §10.
3. `AgentContext` exposes `memory: MemoryStore` (engineer-auth extends
   the context type in `src/agents/**`).
4. Retention + cap paths exercised by a soak test (1 h, 3 agents, cap
   triggers at least once).
5. Telemetry counters land in `src/integration/**` so the demo runner
   prints `memory.get/set/append/query` rates.

Until all five are true, Phase 3 feature slices stay `researching`.

## 8. Candidate file areas

```
src/memory/
  index.ts          # re-exports MemoryStore, types, errors
  types.ts          # records/events/option shapes
  errors.ts         # MemoryFullError, MemoryClosedError
  sqlite-store.ts   # SqliteMemoryStore (node:sqlite or better-sqlite3)
  retention.ts      # sweeper + cap enforcement
  mutex.ts          # async mutex (or p-queue size=1)
test/memory/{sqlite-store,retention,concurrency}.test.ts
```

No writes outside `src/memory/**` except the `AgentContext` type and
demo-runner wiring, which live in their own slices.

## 9. Phased slice breakdown

| Slice | Surface | Depends on |
| --- | --- | --- |
| `memory-store-impl` | `src/memory/{index,types,errors,sqlite-store,mutex}.ts` + unit tests | this doc |
| `memory-retention`  | `src/memory/retention.ts` + TTL/cap tests | `memory-store-impl` |
| `memory-telemetry`  | counters in `src/integration/**` + demo-runner print path | `memory-store-impl` |

Each ≤200 LOC of test-covered code; `memory-store-impl` is the gatekeeper.

## 10. Acceptance criteria (engineer-facing)

1. `set` then `get` returns identical `value` and non-zero `updatedAt`.
2. TTL: `set(k,v,10)`, wait 20 ms, `get` returns `null` and the row is gone from disk.
3. `list({prefix:"job:"})` returns only matching keys, DESC `updated_at`, honoring `limit`.
4. `append` returns monotonically increasing `id`; `query({since})` only returns newer events.
5. Event-log cap: `append` 10 001 events for one agent — oldest gone, newest present, count == 10 000.
6. 100 interleaved `set`/`append` calls across 4 agents complete without `SQLITE_BUSY` and preserve per-agent FIFO on the event log.
7. `close()` is idempotent; calls after close throw `MemoryClosedError`.

## 11. Open questions

1. **Driver:** `node:sqlite` (Node 22+, no native dep) vs `better-sqlite3` (sync, fastest). Lean `node:sqlite`; engineer decides.
2. **JS mutex vs `BEGIN IMMEDIATE`:** could rely on SQLite's own write lock; measure in `memory-store-impl`.
3. **Per-agent DB files:** trivial retention but blows up file handles above ~50 agents. Sticking with one DB for Phase 3.
4. **Satellite sync:** out of scope; future `memory-sync-satellite` slice once Mac-side shape exists.
5. **Encryption at rest:** `memory.sqlite` sits next to credentials; Phase 3 assumes filesystem perms are enough. Revisit with `provider-auth` owner if threat model changes.
