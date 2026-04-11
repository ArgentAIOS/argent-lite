# Task 015 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: ci-run-verify
Branch: codex/ci-run-verify (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- .github/workflows/ci.yml                  (fix if needed)
- docs/ci-status.md

## Goal

1. Run `gh run list --branch codex/ops-team-bootstrap --limit 5` —
   check what the latest CI workflow run did.
2. If the workflow hasn't run at all, trigger one via `gh workflow run ci.yml --ref codex/ops-team-bootstrap` or push a trivial empty commit with a `[ci]` tag via something you're authorized to write to (you can push to codex/ci-run-verify).
3. If a run exists and failed, READ the failure logs with `gh run view <id> --log-failed`, diagnose, and fix `.github/workflows/ci.yml` if the issue is in the workflow (not in the code — do not touch src/**). Retry.
4. Document findings in `docs/ci-status.md`:
   - last run id + conclusion (success/failure/in-progress)
   - any fixes you applied
   - expected green path
5. Update `docs/ci-status.md` is a new file; feel free to write it fresh.

## Constraints

- Do NOT touch `src/**`, `tests/**`, `package.json`, `tsconfig.json`.
- You can edit `.github/workflows/ci.yml` only if a fix is needed.
- Strict Markdown, no broken links.

## Acceptance criterion

- `docs/ci-status.md` exists and describes current CI state.
- A green CI run exists on codex/ci-run-verify OR a clear "cannot trigger without maintainer action" note.
- SELF-COMMIT, PUSH, PR.

## Deadline: before next cron tick.
