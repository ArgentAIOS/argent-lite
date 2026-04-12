# Task 002 — architect

Contract: ops/contracts/architect.contract.md
Runbooks: ops/runbooks/research-planning.md, ops/runbooks/slice-management.md
Slice: argent-lite-scope-decision (research/planning, being opened by this task)
Branch: codex/ops-team-bootstrap (slice expansion, not a new branch)
Surface: read-only except ops/team/outbox/architect.md AND ops/projects/argent-lite-scope-decision.md (write authorized)

## Goal

Formalize your cycle-1 memo into the canonical scope-decision document at
`ops/projects/argent-lite-scope-decision.md`, following the planning
package shape from `ops/runbooks/research-planning.md` §6 and §9.

Your cycle-1 memo is archived at `ops/team/archive/cycle-001/architect.md`.
Read it first. The cycle-2 document should NOT duplicate the memo verbatim
— it should promote the memo's verdicts into the research-planning.md §9
shape, which requires:

- decision summary
- scope
- explicit non-goals
- candidate file areas
- phased execution order (phase 1 = what ships first, phase 2, etc.)
- future slice breakdown
- acceptance criteria
- open questions

Add these two things that were not in the cycle-1 memo:

1. A **phase plan** ordering the follow-on slices
   (`provider-auth-design`, `model-router-lite`, `agent-topology-lite`,
   future DEFER items) with explicit dependencies.
2. An **approval section** at the top: a short paragraph the operator
   can read and say yes/no to, naming exactly what gets built first if
   approved (model router + provider auth, headless, two runtime modes).

After writing the document, also update `ops/team/outbox/architect.md`
with the standard output shape (confirmation line, summary, files
touched, rationale, blockers) so the team lead has an audit trail.

## Acceptance criterion

- `ops/projects/argent-lite-scope-decision.md` exists and matches the
  research-planning.md §9 shape.
- `ops/team/outbox/architect.md` contains the confirmation line and the
  standard architect output shape.
- No files outside the two paths above are modified.

## Validation commands

n/a.

## Deadline

Before the next operator check-in.
