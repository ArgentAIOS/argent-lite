# Task 001 — engineer

Contract: ops/contracts/engineer.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: n/a (audit task, not implementation)
Branch: n/a (read-only)
Surface: read-only except ops/team/outbox/engineer.md

## Goal

Audit the current repo against the runbooks and produce a **gap report**.
The scope decision for Argent Lite is pending, so no application code may
be written yet. This task is to inventory what the runbooks *claim*
exists versus what actually exists on disk, so the team lead can fix or
rewrite the runbooks before real implementation starts.

Check at minimum:

- every script referenced in `ops/runbooks/pr-workflow.md`, `bug-patrol.md`,
  `feature-patrol.md`, `incident-response.md` — does the file exist under
  `scripts/`?
- every worktree path referenced in `ops/runbooks/dev-workflow.md` and
  `ops/rules/branching.md` — does it exist?
- `pnpm build`, `pnpm check`, `pnpm test`, `pnpm protocol:check`,
  `pnpm --dir dashboard build` from `dev-workflow.md` — would any of
  these actually run today? (Do **not** execute them; report expected
  failure modes based on file state.)
- `https://argentos.ai` references — is that the Lite deployment target
  or inherited from argentos-core? Flag the ambiguity.
- presence of `package.json`, `src/`, `dashboard/`.

## Acceptance criterion

Report at `ops/team/outbox/engineer.md` matches the engineer output shape
in `ops/contracts/engineer.contract.md`. For every claim in the runbooks,
the report states `PRESENT`, `MISSING`, or `AMBIGUOUS` with an absolute
path and a one-line note.

## Validation commands

n/a (audit, not build).

## Deadline

Before the next operator check-in.
