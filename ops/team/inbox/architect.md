# Task 005 — architect

Contract: ops/contracts/architect.contract.md
Runbooks: ops/runbooks/research-planning.md, ops/runbooks/slice-management.md
Slice: agent-lifecycle-design
Branch: codex/agent-lifecycle-design (worktree /home/jason/code/argent-lite-cli — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/agent-lifecycle-design.md      (create)

## Context

Phase 2 planning landed in `ops/projects/agent-topology-lite.md`. Your
cycle-5 task is the next layer of detail: **how does one agent actually
run on the Pi?** Two engineers are implementing skeletons in parallel:

- engineer-auth → `src/agents/**` (BaseAgent, AgentContext, lifecycle hooks)
- engineer-router → `src/scheduler/**` (Scheduler, TaskQueue)

They need a one-page interface contract between agents and scheduler
before they can integrate.

## Goal

Write `ops/projects/agent-lifecycle-design.md` (≤150 lines) covering:

1. **Agent lifecycle states**: `init → ready → running → suspended → stopped`.
   Which state transitions are legal? Which are async?
2. **AgentContext shape**: what does the scheduler inject into an agent
   when it starts? (logger, router, credential store, message bus handle,
   resource limits struct).
3. **Message bus contract**: agents send/receive messages. Transport is
   in-proc `EventEmitter` for Phase 2. Message shape:
   `{ id, from, to, kind, payload, ts }`. Delivery: best-effort,
   in-order per (from, to) pair.
4. **Scheduler API**: `register(agent)`, `start(agentId)`, `stop(agentId)`,
   `list(): AgentDescriptor[]`. Include a `tick()` method for deterministic
   testing.
5. **Resource limits**: per-agent `maxMemMb`, `maxWallMs`, `maxConcurrentRouterCalls`.
   How are they enforced? (soft warn + hard kill via `AbortController`).
6. **Failure semantics**: what happens if an agent throws during `run()`?
   If it blocks the event loop? If it exceeds a limit?

### Required sections

- Decision summary (≤3 sentences)
- Interface signatures (TS-ish, no implementation)
- Sequence diagram (ASCII) showing scheduler → agent → router round-trip
- Test acceptance criteria that engineer-auth and engineer-router must hit
- Open questions (anything left for next round)

## Acceptance criterion

- `ops/projects/agent-lifecycle-design.md` exists, ≤150 lines.
- `ops/team/outbox/architect.md` has the confirmation line + standard shape.
- You SELF-COMMIT, PUSH, and OPEN a PR via `gh pr create --base codex/ops-team-bootstrap --head codex/agent-lifecycle-design`.
- No files touched outside the authorized surface.

## Validation

- `wc -l ops/projects/agent-lifecycle-design.md` — report the count.
- `ls ops/projects/agent-lifecycle-design.md`

## Deadline

Before the next cron tick (5 minutes).
