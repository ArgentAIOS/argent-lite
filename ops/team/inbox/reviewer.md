# Task 003 — reviewer

Contract: ops/contracts/reviewer.contract.md
Runbooks: ops/runbooks/maintainer-gate.md, ops/runbooks/pr-workflow.md
Slice: phase1-review
Branch: codex/phase1-review (in worktree /home/jason/code/argent-lite-review)
Surface: read-only everywhere except ops/team/outbox/reviewer.md.

## Context

Operator approved Phase 1 of the Argent Lite scope decision on
2026-04-11 and authorized autonomous multi-agent execution. Four other
agents are implementing phase 1 in parallel on child branches:

| Role | Branch | Slice |
| --- | --- | --- |
| architect | codex/cli-scaffold | cli-scaffold (design + CLI skeleton) |
| engineer-floor | codex/project-floor | project-floor (package.json, tsconfig, vitest) |
| engineer-auth | codex/provider-auth | provider-auth (src/auth/**) |
| engineer-router | codex/model-router-lite | model-router-lite (src/router/**, src/providers/**) |

## Goal

Continuously review the other four slices as their commits land. You
are **read-only** on source — your output is a single markdown file at
`ops/team/outbox/reviewer.md` that gets OVERWRITTEN each review pass.

### Review pass format (overwrite outbox each pass)

```
I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Review pass <N> — <ISO timestamp>

### Branch status
- codex/project-floor     : <commit sha> | <PASS|FAIL|BLOCKED|NO-COMMITS>
- codex/provider-auth     : <commit sha> | <PASS|FAIL|BLOCKED|NO-COMMITS>
- codex/model-router-lite : <commit sha> | <PASS|FAIL|BLOCKED|NO-COMMITS>
- codex/cli-scaffold      : <commit sha> | <PASS|FAIL|BLOCKED|NO-COMMITS>

### Findings (bulleted, per branch)
- <branch>: <line-level note with file:line>

### Rules violated
- <rule-file>: <branch>: <what>

### Missing files
- <path>: <branch>: <why this was required by the inbox task>

### Verdict
OVERALL: <PASS|FAIL|BLOCKED>  (PASS only if all four branches pass)
```

### What to check per branch

**codex/project-floor**
- `package.json` valid JSON, has the scripts listed in the engineer-floor inbox.
- `tsconfig.json` is strict, ESM, Node 22 target.
- `vitest.config.ts` is ESM-shaped.
- `src/index.ts` and `tests/smoke.test.ts` exist.
- Report whether `pnpm install && pnpm check && pnpm test && pnpm build` succeed (run them in the review worktree if package.json exists there).

**codex/provider-auth**
- Seven files at the exact paths in the engineer-auth inbox.
- No `any`, no `@ts-ignore`, no `as unknown as`.
- `file-backend.ts` uses AES-256-GCM from Node's `crypto`.
- No new dependencies added (grep the branch for `package.json` diff).
- Tests use `os.tmpdir()`, not hard-coded paths.

**codex/model-router-lite**
- Twelve files at the exact paths in the engineer-router inbox.
- No import of `src/auth/` (must be injected).
- No new dependencies.
- Tests mock `fetch`, not real network.

**codex/cli-scaffold**
- `ops/projects/phase1-design.md` is one page (≤150 lines).
- `src/cli/index.ts` ≤60 lines.
- `src/config/mode.ts` ≤80 lines.
- `tests/cli/smoke.test.ts` has real assertions.

### Polling cadence

Every review pass, run:

```bash
git -C /home/jason/code/argent-lite-floor    log -1 --format='%h %s' || echo "NO-COMMITS"
git -C /home/jason/code/argent-lite-auth     log -1 --format='%h %s' || echo "NO-COMMITS"
git -C /home/jason/code/argent-lite-router   log -1 --format='%h %s' || echo "NO-COMMITS"
git -C /home/jason/code/argent-lite-cli      log -1 --format='%h %s' || echo "NO-COMMITS"
```

Then run the validation commands in each branch's worktree. Then
overwrite `ops/team/outbox/reviewer.md` with the latest review pass.
Sleep 120 seconds between passes. Run until all four branches PASS or
the threadmaster sends a new inbox task. Do NOT merge — merging is a
threadmaster action.

## Acceptance criterion

- `ops/team/outbox/reviewer.md` reflects the most recent review pass
  with the format above.
- No file outside `ops/team/outbox/reviewer.md` is modified.
- At least three review passes are recorded before you report BLOCKED
  or stop.

## Deadline

Runs continuously until threadmaster issues a new task.
