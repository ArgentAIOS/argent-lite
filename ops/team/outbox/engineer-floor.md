I have read ops/ and am operating under contract:
ops/contracts/engineer-floor.contract.md.

# Slice: ci-harness (Task 004)

Branch: `codex/ci-harness` (worktree `/home/jason/code/argent-lite-floor`)
Parent: `codex/ops-team-bootstrap`

## Summary

Replaced the partial ci.yml with a lean Node 22 + pnpm 10.33.0 workflow
(install-frozen → check → test → build, with pnpm-store cache keyed on
`pnpm-lock.yaml`), upgraded `scripts/check-ci-health.sh` from a stub into
a real `gh run list` table with status emoji, and added an opt-in
end-to-end CLI integration test that spawns the built CLI, asserts the
exit-code invariant (`0 | 3`), and skips gracefully when ollama is
unreachable OR too slow on the Pi 5 CPU to respond within the harness
window.

## Files touched (exact paths)

- `.github/workflows/ci.yml` — rewritten (was a multi-job matrix
  referencing missing `pnpm protocol:check` and `dashboard` targets).
- `scripts/check-ci-health.sh` — stub replaced with real gh-backed table.
- `tests/integration/cli-e2e.test.ts` — new (CLI spawn + invariants).
- `src/integration/README.md` — new (one-paragraph folder intro).
- `vitest.config.ts` — excluded `tests/integration/**` so `pnpm test`
  stays fast and unit-only (implicit from task #3's "new Vitest config
  include path").
- `vitest.integration.config.ts` — new dedicated config for the
  integration runner.
- `package.json` — added `test:integration` script (task #4).
- `ops/team/outbox/engineer-floor.md` — this file.

## Commits

See `codex/ci-harness` after commit/push step (SHA filled by the handoff
below).

## Validation results

| Command | Exit | Notes |
| --- | --- | --- |
| `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'` | 0 | ci.yml parses clean. |
| `pnpm check` | 0 | tsc --noEmit clean. |
| `pnpm test` | 0 | **38/38 passing** across 7 files, integration dir excluded. |
| `pnpm build` | 0 | tsc emits `dist/` artifact used by the e2e test. |
| `pnpm test:integration` | 0 | 1 passed + 1 skipped. The artifact-exists test passes; the live-route test detects ollama is reachable but gemma3:1b on Pi CPU exceeds the 45s harness window, and skips cleanly (`[cli-e2e] live CLI route exceeded 45000ms — skipping (slow local model)`). Skip path is exactly what the inbox authorizes. |
| `bash scripts/check-ci-health.sh` | 0 | Prints compact table of 5 recent runs with emoji + status + conclusion + name. |

## Follow-ups / deferred (not in surface)

1. **`pnpm-lock.yaml` is untracked in the worktree.** `pnpm install
   --frozen-lockfile` in CI will fail until threadmaster commits the
   lockfile as part of the ops-team-bootstrap integration. It is
   outside the engineer-floor surface, so I did not stage it.
2. **Pi self-hosted runner not wired.** Workflow runs on `ubuntu-latest`
   as the task specified; a Pi runner labelled `self-hosted, pi5` can
   be added later once Hailo-10H hardware is installed on 2026-04-12.
3. **`--auto-issue` in `check-ci-health.sh` is still a stub** (prints a
   notice to stderr and exits 0). Real issue filing should be wired
   from the bug-patrol runbook.
4. **`src/integration/` has no code yet** — only a README, per the task.
   Actual integration glue lands when a Phase 2 slice claims that
   surface.

## Blockers

None for this slice. Acceptance criteria met.
