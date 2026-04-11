# Task 005 — reviewer

Contract: ops/contracts/reviewer.contract.md
Runbooks: ops/runbooks/maintainer-gate.md, ops/runbooks/pr-workflow.md
Slice: cycle5-review
Branch: codex/phase1-review (worktree /home/jason/code/argent-lite-review — reuse, reset to latest)
Surface: read-only everywhere except ops/team/outbox/reviewer.md.

## Context

Cycle-4 is integrated and shipped (ba63bec, 59/59 tests green, 4 PRs
merged). Cycle-5 is now running four new slices in parallel:

| Role | Branch | Slice |
| --- | --- | --- |
| architect | codex/agent-lifecycle-design | Phase 2 interface contract |
| engineer-floor | codex/ci-live | verify + nightly CI |
| engineer-auth | codex/agent-skeleton | src/agents/** base + bus |
| engineer-router | codex/scheduler-skeleton | src/scheduler/** |

## Goal — ONE single pass, then exit

Run exactly ONE review pass and overwrite
`ops/team/outbox/reviewer.md` with the format below. Do NOT loop.

```
I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Review pass — cycle-5 — <ISO timestamp>

### Branch commit check
- codex/agent-lifecycle-design  : <sha + subject, or NO-COMMITS>
- codex/ci-live                 : <…>
- codex/agent-skeleton          : <…>
- codex/scheduler-skeleton      : <…>

### Test status (per branch worktree)
- <branch>: <pnpm test result or SKIPPED because>

### Findings per branch
- <file:line note>

### Rules violated
- <if any>

### Missing files
- <per inbox>

### Verdict
OVERALL: <PASS|FAIL|BLOCKED>
```

For each branch worktree, run `pnpm check && pnpm test` where
`package.json` exists and report real exit codes.

## Acceptance criterion

- Single review pass committed to `ops/team/outbox/reviewer.md`.
- No files modified outside that path.
- Run once and exit — the launcher wraps you in a loop but your task
  should still be a single pass per invocation.

## Deadline

≤5 minutes.
