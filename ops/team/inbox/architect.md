# Task 004 — architect

Contract: ops/contracts/architect.contract.md
Runbooks: ops/runbooks/research-planning.md, ops/runbooks/slice-management.md
Slice: agent-topology-lite (research/planning slice — Phase 2)
Branch: codex/agent-topology-lite (worktree /home/jason/code/argent-lite-cli — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/agent-topology-lite.md            (create)

## Context

Phase 1 is live on `codex/ops-team-bootstrap` (see ops/slices/REGISTRY.md).
The operator greenlit autonomous execution of the full port. The scope
decision names `agent-topology-lite` as the **Phase 2 gate**: nothing in
Phase 3 (memory-lite, intent-routing-lite, channels-lite) can be opened
until the topology is designed.

## Goal

Produce a one-page planning document at
`ops/projects/agent-topology-lite.md` following the
`ops/runbooks/research-planning.md` §9 shape. It should answer:

1. **What is the minimum viable agent model for Argent Lite on a Pi 5 + Hailo-10H?**
   - How many concurrent agents?
   - What scheduler (event loop, worker_threads, child processes, cron)?
   - How are agents isolated (memory limits, timeouts, crash recovery)?
   - How does an agent consume the ModelRouter that Phase 1 shipped?
2. **How does the topology differ between satellite and standalone modes?**
   - In satellite mode, which agents run locally on the Pi vs. delegate to Mac?
   - In standalone mode, what is the full local set?
3. **What's the contract between agents?** Message shape, delivery
   guarantees (best-effort? at-least-once?), transport (in-proc EventEmitter? SQLite queue?).
4. **Candidate file areas** under `src/agents/` and `src/scheduler/`.
5. **Phase 3 unblock:** what must be true about the topology before
   memory-lite and intent-routing-lite can be opened?

### Required sections

- Decision summary (≤3 sentences)
- Scope (IN / OUT / DEFER tables)
- Explicit non-goals
- Candidate file areas (one-line purpose each)
- Phased execution order for Phase 2 sub-slices
- Acceptance criteria
- Open questions

### Out of scope for this document

- Implementation code (this is a planning slice).
- Hailo-specific details beyond "an agent may request a local-first
  route and the router handles provider selection."
- Memory layer design — that's memory-lite's job.

## Acceptance criterion

- `ops/projects/agent-topology-lite.md` exists and is ≤200 lines.
- `ops/team/outbox/architect.md` has the confirmation line and the
  standard output shape (summary, rationale citing rules/runbooks,
  risks/non-goals, recommended follow-on slices, files touched).
- No files touched outside the authorized surface.

## Validation commands

- `wc -l ops/projects/agent-topology-lite.md` — report the count.
- `ls ops/projects/` — confirm the file landed.

## Deadline

Before the next cron tick (5 minutes).
