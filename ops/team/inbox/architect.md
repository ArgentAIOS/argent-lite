# Task 006 — architect

Contract: ops/contracts/architect.contract.md
Slice: memory-lite-design
Branch: codex/memory-lite-design (worktree /home/jason/code/argent-lite-cli)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/memory-lite-design.md

## Context

Phase 2 skeletons are live (agents + scheduler + CI + 78 tests). Next
Phase 3 gate: memory. Argent Lite must give agents a per-agent memory
store that fits a Pi 5 (SQLite only, no Postgres/Redis per the scope
decision).

## Goal

Write `ops/projects/memory-lite-design.md` (≤150 lines) per
`ops/runbooks/research-planning.md` §9 shape:

1. **Decision summary** — SQLite-only key-value + append-only event log per agent.
2. **Data model** — tables: `kv(agent_id, key, value_json, updated_at)`,
   `events(id, agent_id, ts, kind, payload_json)`. Index on
   `(agent_id, updated_at desc)`.
3. **API surface** — `MemoryStore` interface with `get/set/list/append/query`.
4. **Retention policy** — TTL per key, cap event log size per agent.
5. **Concurrency** — one writer, serialized via an async mutex.
6. **Phase 3 unblock** — what must be true before `intent-routing-lite`
   and `channels-lite` can open.
7. Candidate file areas: `src/memory/**`.
8. Phased slice breakdown (`memory-store-impl`, `memory-retention`,
   `memory-telemetry`).
9. Acceptance criteria.
10. Open questions.

## Acceptance criterion

- Doc exists ≤150 lines, matches research-planning §9 shape.
- Architect outbox contains confirmation line + standard output shape.
- SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/memory-lite-design`.

## Deadline

Before next cron tick.
