I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision Summary

Promoted the cycle-1 scope memo into the canonical planning document at
`ops/projects/argent-lite-scope-decision.md`, following the
`ops/runbooks/research-planning.md` §9 shape. Added the operator approval
section and a phased execution plan with explicit dependencies across
three phases: (1) model router + provider auth, (2) agent topology,
(3) deferred subsystems unlocked by topology.

## Rationale

- `ops/runbooks/research-planning.md` §6, §9 — planning package shape
  (decision summary, scope, non-goals, candidate file areas, phased
  execution, slice breakdown, acceptance criteria, open questions).
- `ops/runbooks/slice-management.md` §8 — planning slices use planning
  statuses, not implementation statuses.
- `ops/CLAUDE.md` — zero application code today; scope decision is
  prerequisite to any implementation.
- `ops/projects/ACTIVE.md` — Argent Lite Scope Decision is `planned`;
  this document fills that slot.
- `ops/team/archive/cycle-001/architect.md` — cycle-1 verdicts promoted
  into the §9 shape, not duplicated verbatim.
- `ops/rules/never-do.md` — no auto-implementation; document proposes only.

## Risks and Non-Goals

**Risks:**
- Phase 1 is intentionally narrow (router + auth). If the operator wants
  broader initial scope, revise before opening impl slices.
- DEFER items stall if phase 2 (agent topology) is not opened promptly.
- Mac-station patrol model does not map to Pi-only deploy; flagged in
  open questions.

**Non-goals:**
- Implementation design for any subsystem.
- Claiming implementation slices.
- Deciding the satellite ↔ standalone protocol boundary.

## Recommended Follow-On Slices

- `provider-auth-design` (phase 1, no dependencies)
- `model-router-lite` (phase 1, depends on provider-auth-design)
- `agent-topology-lite` (phase 2, depends on phase 1)
- `memory-lite`, `intent-routing-lite`, `channels-lite` (phase 3, depend on phase 2)

## Files Touched

- `ops/projects/argent-lite-scope-decision.md` (created)
- `ops/team/outbox/architect.md` (this file)

## Contract Reference

`ops/contracts/architect.contract.md` — Task 002.

## Blockers / Open Questions

None blocking this deliverable. The document awaits operator approval
before phase 1 slices can be opened.
