# Task 005 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: ci-live
Branch: codex/ci-live (worktree /home/jason/code/argent-lite-floor — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- .github/workflows/ci.yml                  (update if needed)
- .github/workflows/nightly.yml             (create — Pi self-hosted smoke)
- scripts/ci-smoke.sh                       (create)
- docs/ci.md                                (create — one page)

## Context

Cycle-4 landed a CI workflow but we haven't verified a real GitHub
Actions run actually succeeds. Also: a nightly job should run on a
self-hosted Pi runner (once registered) to smoke-test against real
ollama. That's future-looking — for now, write the workflow file
plus docs, keep the runner registration manual.

## Goal

1. **Verify the existing CI run** — check `gh run list --branch
   codex/ops-team-bootstrap` for the most recent run triggered by the
   cycle-4 merge. If it's red, fix the workflow. If it doesn't exist,
   trigger it with `gh workflow run ci.yml` (or a push).
2. **`.github/workflows/nightly.yml`** — scheduled at `0 7 * * *` UTC,
   `runs-on: [self-hosted, argent-lite, pi5]`, runs
   `bash scripts/ci-smoke.sh`. Set `continue-on-error: true` for now so
   a missing runner doesn't mark the repo red.
3. **`scripts/ci-smoke.sh`** — bash, `set -euo pipefail`, runs:
   - `pnpm install --frozen-lockfile`
   - `pnpm check`
   - `pnpm test`
   - `pnpm build`
   - `ARGENT_MODE=standalone node dist/src/cli/index.js "ci smoke $(date -Iseconds)"`
   - exits with whatever the CLI returned
4. **`docs/ci.md`** — one page (~60 lines) documenting: what each
   workflow does, how to register a Pi as a self-hosted runner
   (`gh runner create`), how to debug a red build, and the ground rules
   (never bypass CI for main/develop).

## Acceptance criterion

- `gh workflow run` or `gh run list` confirms at least one successful
  run on `codex/ops-team-bootstrap`. If one isn't running, trigger it.
- All surface files exist and validate.
- SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/ci-live`.

## Validation

- `bash -n scripts/ci-smoke.sh`
- `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/nightly.yml"))'`
- `gh run list --branch codex/ops-team-bootstrap --limit 3` — report

## Deadline

Before the next cron tick.
