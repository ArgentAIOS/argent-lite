# Task 006 — reviewer

Contract: ops/contracts/reviewer.contract.md
Slice: cycle6-review
Branch: codex/phase1-review (worktree /home/jason/code/argent-lite-review)
Surface: read-only except ops/team/outbox/reviewer.md.

## Context

Cycle-5 integrated at `9373530` (78/78 tests). Cycle-6 runs 4 new
slices in parallel:

| Role | Branch | Slice |
| --- | --- | --- |
| architect | codex/memory-lite-design | Phase 3 memory design |
| engineer-floor | codex/demo-runner | end-to-end demo runner |
| engineer-auth | codex/agent-helloagent | HelloAgent proof |
| engineer-router | codex/context-router-bridge | agents ↔ router wiring |

## Goal — ONE single pass, then exit

**Do not commit a PR for your review outbox** — previous cycle
accidentally opened PR #12. Write only to
`ops/team/outbox/reviewer.md` in your worktree and let threadmaster
read it directly. Do NOT run `git add/commit/push` for the review
outbox. Do NOT run `gh pr create`.

Single pass format:

```
I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Review pass — cycle-6 — <ISO timestamp>

### Branch commit check
- codex/memory-lite-design    : <sha or NO-COMMITS>
- codex/demo-runner           : <sha or NO-COMMITS>
- codex/agent-helloagent      : <sha or NO-COMMITS>
- codex/context-router-bridge : <sha or NO-COMMITS>

### Test status
- <branch>: <pnpm test result or SKIPPED>

### Findings per branch
- <file:line note>

### Rules violated
- <if any>

### Missing files
- <per inbox>

### Verdict
OVERALL: <PASS|FAIL|BLOCKED>
```

## Acceptance criterion

- Review pass overwrites `ops/team/outbox/reviewer.md` in your worktree.
- NO git commit, NO PR.
- Run once and exit.

## Deadline

≤5 minutes.
