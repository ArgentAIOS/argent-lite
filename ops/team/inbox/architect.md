# Task 009 — architect

Contract: ops/contracts/architect.contract.md
Slice: observability-design
Branch: codex/observability-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/observability-design.md

## Goal

Write `ops/projects/observability-design.md` (≤150 lines):

1. What do we log? (structured JSON lines to stderr + optional file sink).
2. What do we count? (metrics: router route count, provider latency histogram, agent message volume, memory write/read).
3. Trace context: optional `trace_id` stamped at channel entry, propagated through bus → agent → router → provider.
4. Transport: no OTLP in Phase 3. Local JSONL only. An exporter slice later.
5. Interfaces: `Logger`, `Metrics`, `Tracer`. TS signatures.
6. Candidate files: `src/obs/**`.
7. Acceptance criteria.

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
