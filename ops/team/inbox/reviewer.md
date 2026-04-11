# Task 001 — reviewer

Contract: ops/contracts/reviewer.contract.md
Runbooks: ops/runbooks/maintainer-gate.md
Slice: ops-team-bootstrap (team lead is the owner)
Branch: codex/ops-team-bootstrap
Surface: read-only except ops/team/outbox/reviewer.md

## Goal

Review the ops-team-bootstrap scaffold the team lead just wrote. The
artifacts under review are:

- ops/CLAUDE.md
- ops/contracts/team-onboarding.contract.md
- ops/contracts/architect.contract.md
- ops/contracts/engineer.contract.md
- ops/contracts/reviewer.contract.md
- ops/workflows/slice-lifecycle.workflow.md
- ops/workflows/team-task-claim.workflow.md

For each, check:

1. Does it cite only files that actually exist in the repo? Flag any
   dangling reference with `file:line`.
2. Does it contradict any rule in `ops/rules/` or any runbook in
   `ops/runbooks/`? If yes, cite both sides.
3. Does the contract match its own stated output shape — i.e. could a
   teammate follow it literally and produce acceptable output?
4. Is there any silent assumption about Mac stations, missing scripts, or
   application code that should have been flagged and wasn't?

Report verdict `PASS`, `FAIL`, or `BLOCKED` at the top of the outbox.

## Acceptance criterion

Report at `ops/team/outbox/reviewer.md` matches the reviewer output shape
in `ops/contracts/reviewer.contract.md`, including a `missing-reference`
list (even if empty) and a `rules-violated` list (even if empty).

## Validation commands

n/a (review is the validation).

## Deadline

Before the next operator check-in.
