# Runbook: Handoff to Threadmaster

> How an implementation agent hands completed work back to the release owner
> without causing branch confusion, file drift, accidental regressions, or
> missing docs follow-through.

## When to Use This

Use this runbook whenever:

- you want Threadmaster to merge or release your work
- you are ending a session with work that needs continuation
- your implementation lives in a different worktree than the clean release lane
- there is any chance the branch name is misleading, stale, or reused
- the change touches another repo such as `/home/jason/code/argent-lite`

## The Core Rule

Use commit/file truth, not branch-name truth.

The handoff is not merge permission by itself. It is a request for
Threadmaster to reconstruct the change in the clean dev/release lane
and present it for operator or human validation before anything lands
on `main`.

## Non-Negotiables

1. Do not tell Threadmaster to merge the branch unless the clean lane proves the intended content.
2. If the real implementation is in a dirty workspace, say so explicitly.
3. If the branch name exists in multiple worktrees, identify the correct worktree path.
4. List exact files, not vague areas.
5. List exclusions, not just inclusions.
6. State build/test status truthfully.
7. If work spans multiple repos, create a separate slice and a separate handoff packet for each repo.
8. Every handoff must state the docs outcome for `https://argentos.ai/lite` using `UPDATED`, `NOT NEEDED`, or `BLOCKED`.
9. Run the handoff checker before intake.
10. Work does not go from `codex/*` directly to `main` unless the owner explicitly overrides the process.

## Promotion Rule

Release-facing work should flow:

1. implementation on `codex/*`
2. reconstruction and validation in the clean dev/release lane
3. merge to `develop`
4. regression test from `develop`
5. operator sign-off
6. promotion from `develop` to `main`

## Required Template

Use this exact structure when handing off:

```markdown
MERGE REQUEST — <short label>

Repo: <argent-lite | other>
Linear: <ID or "unavailable">
Author: <agent id>

Source of truth:

- Use commit/file truth only: YES | NO
- Branch: `<branch>`
- Worktree: `<absolute path>`
- Commit: `<short sha>`
- Tree state: CLEAN | DIRTY

Intended files only:

- `path/to/file-a`
- `path/to/file-b`

Explicit exclusions:

- `ops/**`
- `path/to/unrelated-file`

Validation:

- `pnpm build` — PASS
- `pnpm check` — PASS
- `pnpm test` — PASS | FAIL | NOT RUN

Operator validation still required:

- `<human smoke or release-lane validation>`
- `<manual verification still pending>`

Public docs:

- Repo: `/home/jason/code/argent-lite`
- Status: UPDATED | NOT NEEDED | BLOCKED
- Files: `docs/...` or `none`
- Notes: <why>

Conflicts / risks:

- `<risk 1>`
- `<risk 2>`

Action required from Threadmaster:

1. Reconstruct this change in the clean dev/release lane from the source files above.
2. Do not trust branch name alone.
3. Re-run the checker and validation in the clean lane.
4. Hand the clean lane to the operator or human for final testing.
5. Only after operator validation passes, recommend merge or release to `main`.
```

## Machine Check

Before handing off, run:

```bash
node scripts/check-handoff.mjs path/to/handoff.md
```
