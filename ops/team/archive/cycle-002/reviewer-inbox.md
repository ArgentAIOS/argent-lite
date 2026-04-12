# Task 002 — reviewer

Contract: ops/contracts/reviewer.contract.md
Runbooks: ops/runbooks/maintainer-gate.md, ops/runbooks/research-planning.md
Slice: ops-team-bootstrap (slice expansion)
Branch: codex/ops-team-bootstrap
Surface: read-only except ops/team/outbox/reviewer.md

## Goal

Review the cycle-2 deliverables from the architect and the engineer.

### Architect deliverable under review

- `ops/projects/argent-lite-scope-decision.md`
- `ops/team/outbox/architect.md` (cycle-2 version)

Checks:

1. Does the scope-decision document match the shape required by
   `ops/runbooks/research-planning.md` §9 (decision summary, scope,
   non-goals, candidate file areas, phased execution order, future
   slice breakdown, acceptance criteria, open questions)?
2. Does the approval section at the top name exactly what ships first
   if the operator approves?
3. Does the phase plan have explicit dependencies between
   follow-on slices?
4. Is the document consistent with the cycle-1 memo at
   `ops/team/archive/cycle-001/architect.md`, or does it quietly
   contradict any verdict?
5. Any dangling file references?

### Engineer deliverable under review

- `scripts/send-pr-email.sh`
- `scripts/send-escalation-email.sh`
- `scripts/check-ci-health.sh`
- `ops/runbooks/dev-workflow.md` (rewritten)
- `ops/rules/branching.md` (updated)
- `ops/team/outbox/engineer.md` (cycle-2 version)

Checks:

1. Are the three new scripts real executable bash stubs with shebang,
   `set -euo pipefail`, structured stub logging, and header comments?
2. Do they exit with the codes the inbox task required (0, 0, 2)?
3. Does `dev-workflow.md` still reference
   `argent-lite-develop-clean` or `argent-lite-main-clean` as mandatory?
   Flag if yes.
4. Does `branching.md` still hard-code the non-existent worktrees as
   required? Flag if yes.
5. Did the engineer touch any file outside the authorized surface?
   Cross-reference the `Files Touched` list in the engineer outbox
   against `git diff --name-only codex/ops-team-bootstrap`.
6. Did the engineer create `package.json` or `src/` anywhere?
   That is explicitly prohibited. Fail the review if yes.

### Verdict rules

- PASS if every check above passes and no prohibited surface is touched.
- FAIL with line-level notes if any check fails.
- BLOCKED if a deliverable is missing or the surface is unclear.

## Acceptance criterion

`ops/team/outbox/reviewer.md` contains the confirmation line, verdict,
findings (bulleted), missing-reference list, and rules-violated list.
Format must match `ops/contracts/reviewer.contract.md`.

## Validation commands

The reviewer should run these to verify the engineer's work:

- `bash -n scripts/send-pr-email.sh`
- `bash -n scripts/send-escalation-email.sh`
- `bash -n scripts/check-ci-health.sh`
- `git diff --name-only` (to see the engineer's actual surface)
- `test -f package.json && echo "PROHIBITED FILE EXISTS" || echo "ok"`

Report real exit codes.

## Deadline

Before the next operator check-in.
