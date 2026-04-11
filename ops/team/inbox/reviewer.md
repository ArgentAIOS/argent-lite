# Task 004 — reviewer

Contract: ops/contracts/reviewer.contract.md
Runbooks: ops/runbooks/maintainer-gate.md, ops/runbooks/pr-workflow.md
Slice: cycle4-review
Branch: codex/phase1-review (worktree /home/jason/code/argent-lite-review — reuse)
Surface: read-only everywhere except ops/team/outbox/reviewer.md.

## Context

Cycle 3 Phase 1 landed successfully (38/38 tests green, PRs #1-#4 all
merged). Cycle 4 is now running four new slices in parallel:

| Role | Branch | Slice |
| --- | --- | --- |
| architect | codex/agent-topology-lite | agent-topology-lite (Phase 2 planning) |
| engineer-floor | codex/ci-harness | CI workflow + e2e integration test |
| engineer-auth | codex/satellite-protocol-stub | satellite client/server protocol |
| engineer-router | codex/hailo-provider-stub | Hailo provider stub + router health |

## Goal — ONE SINGLE PASS (not a loop)

Run exactly ONE review pass and write the result to
`ops/team/outbox/reviewer.md` using the format below. DO NOT loop.
DO NOT sleep. Threadmaster will relaunch you on the next cycle.

```
I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Review pass — cycle-4 — <ISO timestamp>

### Branch commit check
- codex/agent-topology-lite    : <latest commit sha + subject, or NO-COMMITS>
- codex/ci-harness             : <…>
- codex/satellite-protocol-stub: <…>
- codex/hailo-provider-stub    : <…>

### Integration branch baseline
- codex/ops-team-bootstrap latest sha + pnpm test summary from the last threadmaster commit

### Findings per branch
- <branch>: <file:line note>

### Rules violated
- <if any>

### Missing files
- <per inbox task surface>

### Verdict
OVERALL: <PASS|FAIL|BLOCKED>
```

### How to look across worktrees

Each worktree holds exactly one cycle-4 branch. Run:

```bash
for wt in cli floor auth router; do
  echo "=== $wt ==="
  git -C /home/jason/code/argent-lite-$wt log --oneline -3
done
```

And verify the cycle-4 branch name matches what the threadmaster
dispatched (see inbox files).

## Acceptance criterion

- `ops/team/outbox/reviewer.md` contains exactly one review pass in
  the format above, then exits. Do not loop.
- No files modified outside `ops/team/outbox/reviewer.md`.

## Deadline

Run once, write the file, exit. ≤5 minutes.
