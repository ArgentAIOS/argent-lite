# CI Status

Last verified: 2026-04-11 (slice `ci-run-verify`, task 015).

## Current state

CI is **green** on the integration branch `codex/ops-team-bootstrap`.

| Field | Value |
| --- | --- |
| Latest run id | `24292573826` |
| Branch | `codex/ops-team-bootstrap` |
| Trigger | `push` |
| Conclusion | `success` |
| Duration | ~34s |
| Commit | `a7c1ad2` ("ops: cycle-15 dispatch — phase4 roadmap + CI verify + satellite server wiring + hailo live") |

The last five runs on `codex/ops-team-bootstrap` all completed `success`
(run ids 24292573826, 24292497246, 24292334301, 24292307519, 24291977169).

## Workflow under test

`.github/workflows/ci.yml` — single job `build-and-test` on `ubuntu-latest`,
runs on every `push`, on `pull_request` into `main`/`develop`/`codex/**`,
and on `workflow_dispatch`.

Steps:

1. Checkout
2. Enable Corepack + pin `pnpm@10.33.0`
3. Setup Node.js 22
4. Cache pnpm store
5. `pnpm install --frozen-lockfile`
6. `pnpm check` (tsc `--noEmit`)
7. `pnpm test` (vitest)
8. `pnpm build` (tsc)

## Fixes applied in this slice

None. The workflow did not need changes — the last run on
`codex/ops-team-bootstrap` went green end-to-end. This slice only adds
this status document and re-runs CI on `codex/ci-run-verify` to confirm
the workflow is still green on a fresh branch push.

## Local validation (on `codex/ci-run-verify`, worktree `argent-lite-floor`)

| Command | Exit code | Notes |
| --- | --- | --- |
| `pnpm check` | 0 | tsc clean |
| `pnpm test` | 0 | 38 test files, 225 tests passed |
| `pnpm build` | 0 | tsc build clean |

These match the CI run on `codex/ops-team-bootstrap` step-for-step.

## Expected green path

On any push to a `codex/**` branch, the `build-and-test` job should:

1. Restore the pnpm store cache (key `Linux-pnpm-<hashFiles pnpm-lock.yaml>`).
2. `pnpm install --frozen-lockfile` → exit 0.
3. `pnpm check` → exit 0.
4. `pnpm test` → `38 files, 225 tests passed`.
5. `pnpm build` → tsc emits with no diagnostics.

The one non-blocking warning in the log is GitHub's notice that
`actions/checkout@v4`, `actions/setup-node@v4`, and `actions/cache@v4`
currently run on Node.js 20; GitHub will force Node.js 24 by 2026-06-02.
This is informational only and does not fail the run. A follow-up slice
may bump these actions or opt in via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.

## How to re-verify

```sh
gh run list --branch codex/ops-team-bootstrap --limit 5
gh run view <run-id> --log-failed    # only if conclusion != success
```

For the PR from this slice, check:

```sh
gh run list --branch codex/ci-run-verify --limit 5
```
