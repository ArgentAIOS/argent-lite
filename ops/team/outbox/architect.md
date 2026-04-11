I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Summary

Task 005 — authored `ops/projects/agent-lifecycle-design.md` (150 lines),
the one-page interface contract between `src/agents/**` and
`src/scheduler/**` for Phase 2 engineers. Covers the 5-state lifecycle
(`init/ready/running/suspended/stopped`) with legal + async transitions,
`AgentContext` injection shape, in-proc `EventEmitter` message contract,
`Scheduler` API including deterministic `tick()`, per-agent resource
limits (wall-clock hard / mem soft / router-call hard) with
`AbortController` enforcement, and explicit failure semantics for throws,
timeouts, and mem breaches. Includes ASCII sequence diagram, TS-ish
signatures, and 11 test-acceptance bullets split across engineer-auth and
engineer-router so both skeletons have a concrete target.

## Decision summary (≤3 sentences)

One agent is a long-lived object owned by the `Scheduler`, driven through
a fixed 5-state lifecycle by scheduler calls and hook completion. The
scheduler injects a single `AgentContext` at `start()` — logger, router,
credentials, bus handle, limits, abort signal — and is the sole enforcer
of `AbortController`-based hard limits. Agents never touch providers,
clocks, or credentials directly; every error surfaces as a stopped-agent
broadcast on the bus.

## Rationale

- Mirrors the constraints already fixed in `ops/projects/agent-topology-lite.md` (single-process, concurrency=3, router-as-choke-point, EventEmitter bus, in-proc only) — this memo is the next layer of detail, not a new direction.
- `ops/contracts/architect.contract.md` limits architect output to a ≤1-page decision memo on a specific question; the inbox question is the agent↔scheduler seam, which is exactly what this file answers.
- `ops/runbooks/research-planning.md` requires planning docs under `ops/projects/` with decision summary, scope, non-goals, acceptance criteria, and open questions — all present.
- `ops/rules/never-do.md`: no application code written, no feature auto-implemented, no merges, planning-only per the runbook.

## Risks and non-goals

- **Non-goal:** no implementation code — engineers on `src/agents/**` and `src/scheduler/**` own that in their own slices.
- **Non-goal:** no wire-protocol design for `RemoteAgentProxy`; satellite auth is still deferred to `satellite-protocol`.
- **Risk:** Node has no cheap per-async-context heap cap; `maxMemMb` stays *soft* (warn + suspend). Confirmed as Phase 2 compromise.
- **Risk:** event-loop blocking (no-await CPU burn) is only caught via missed tick deadlines — acceptable for Phase 2, called out in open questions.
- **Risk:** `AgentContext.limits` is frozen at `start()`; runtime knob comes in Phase 3 with `channels-lite`.

## Files touched

- `ops/projects/agent-lifecycle-design.md` (created, 150 lines)
- `ops/team/outbox/architect.md` (this file)

No files touched outside the authorized surface.

## Validation

- `wc -l ops/projects/agent-lifecycle-design.md` → **150** (≤150 ✓)
- `ls ops/projects/agent-lifecycle-design.md` → present
- No `package.json` changes in this slice surface; `pnpm test`/`check`/`build` not run (planning-only doc, no code).

## Commits / PR

- Branch: `codex/agent-lifecycle-design` (reused worktree `/home/jason/code/argent-lite-cli`)
- Commit: self-committed with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Pushed to `origin/codex/agent-lifecycle-design`
- PR opened against `codex/ops-team-bootstrap`

## Recommended follow-on slices (names only — not claimed)

- `agent-runtime-lite` — `BaseAgent` + state machine + `ctx.signal` plumbing (engineer-auth).
- `agent-scheduler-lite` — `Scheduler` with deterministic `tick()` + limits (engineer-router).
- `agent-bus-lite` — typed EventEmitter wrapper with FIFO-per-pair delivery.
- `agent-topology-integration` — end-to-end smoke wiring all three above.

## Blockers / open questions

None blocking. Four non-blocking open questions carried forward in the
design doc (suspended-agent inbox policy, heap sampler cadence, `limits`
mutability, broadcast back-pressure). These are follow-ups for the
engineer slices, not preconditions for starting them.

Contract trace: `ops/contracts/architect.contract.md` →
`ops/contracts/team-onboarding.contract.md`.
