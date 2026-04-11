# Task 004 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: ci-harness
Branch: codex/ci-harness (worktree /home/jason/code/argent-lite-floor — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- .github/workflows/ci.yml                  (create or update)
- scripts/check-ci-health.sh                (reuse existing stub — update to real check)
- tests/integration/cli-e2e.test.ts         (create)
- src/integration/README.md                 (create, 1 paragraph)

## Context

Phase 1 is live on codex/ops-team-bootstrap with 38/38 unit tests.
Missing: a CI workflow that runs `pnpm install && pnpm check && pnpm
test && pnpm build` on every push, and an end-to-end integration test
that actually boots the CLI and asserts something from it.

## Goal

1. **GitHub Actions workflow** at `.github/workflows/ci.yml`:
   - Triggers on `push` to any branch and `pull_request` targeting
     `main`, `develop`, or `codex/**`.
   - Runs on `ubuntu-latest` (Pi self-hosted runner can come later).
   - Node 22, pnpm 10.33.0 via corepack.
   - Steps: checkout → setup-node → `pnpm install --frozen-lockfile` →
     `pnpm check` → `pnpm test` → `pnpm build`.
   - Cache pnpm store by lockfile hash.
2. **Upgrade `scripts/check-ci-health.sh`** from the stub into a real
   script that runs `gh run list --limit 5 --json status,conclusion,name`
   and prints a compact table with status emoji. Still accepts
   `--auto-issue` but leaves it as a stub for now.
3. **End-to-end integration test** at `tests/integration/cli-e2e.test.ts`:
   - Spawns `node dist/src/cli/index.js "ping"` as a child process.
   - Mocks the network somehow OR sets `ARGENT_MODE=standalone` and
     accepts that the test will only run if `ollama` is reachable at
     `localhost:11434`. If ollama is down, the test should SKIP, not FAIL.
   - Asserts non-zero exit is 3 (router failed) and zero exit emits
     something to stdout.
   - Register this test under a new Vitest config include path so it
     only runs when explicitly requested (`pnpm test:integration`).
4. Add `test:integration` script to package.json pointing at `vitest run tests/integration`.
5. Short README at `src/integration/README.md` explaining the folder.

## Acceptance criterion

- `.github/workflows/ci.yml` lints cleanly (`yamllint` or
  `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'`).
- `pnpm test` still passes 38/38 on the integration branch after
  rebasing this slice (threadmaster will rebase).
- `pnpm test:integration` exists and runs (can be skipped if ollama is
  down — skip is acceptable, failure is not).
- `ops/team/outbox/engineer-floor.md` has confirmation line, files
  touched, real validation exit codes.

## Validation commands

- `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'`
- `pnpm test` — 38/38 expected
- `bash scripts/check-ci-health.sh` — should print a table or "no runs"

## Deadline

Before the next cron tick.
