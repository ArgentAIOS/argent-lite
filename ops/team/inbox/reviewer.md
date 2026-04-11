# Task 007 — reviewer

Contract: ops/contracts/reviewer.contract.md
Slice: cycle7-review
Branch: codex/phase1-review (worktree /home/jason/code/argent-lite-review)
Surface: read-only except ops/team/outbox/reviewer.md (in your worktree).

## Context

Cycle-6 integrated at `34ac4aa` (90/90 tests). Cycle-7 slices:

| Role | Branch | Slice |
| --- | --- | --- |
| architect | codex/channels-lite-design | Phase 3 channels design |
| engineer-floor | codex/hailo-bootstrap | Hailo setup scripts + runtime probe |
| engineer-auth | codex/memory-store-impl | SQLite MemoryStore impl |
| engineer-router | codex/router-agent | RouterAgent (real router call over bus) |

## Goal — ONE pass, no PR

Run exactly ONE review pass. **Do NOT git commit/push** the outbox
— threadmaster reads it directly from your worktree. Do NOT
`gh pr create`.

Single pass format (overwrite `ops/team/outbox/reviewer.md` in your worktree):

```
I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Review pass — cycle-7 — <ISO timestamp>

### Branch commit check
- codex/channels-lite-design : <sha or NO-COMMITS>
- codex/hailo-bootstrap      : <…>
- codex/memory-store-impl    : <…>
- codex/router-agent         : <…>

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

## Deadline

≤5 minutes.
