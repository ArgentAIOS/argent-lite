# CI / Nightly

Argent Lite uses two GitHub Actions workflows.

## `.github/workflows/ci.yml` — per-push CI

Triggers: every push to any branch, every PR into `main`, `develop`, or
`codex/**`, and `workflow_dispatch`.

Runner: `ubuntu-latest` (GitHub-hosted).

Steps:

1. `actions/checkout@v4`
2. Enable Corepack and pin `pnpm@10.33.0`
3. Setup Node 22
4. Cache the pnpm store keyed on `pnpm-lock.yaml`
5. `pnpm install --frozen-lockfile`
6. `pnpm check` — TypeScript typecheck
7. `pnpm test` — unit + integration (59/59 as of cycle-4)
8. `pnpm build`

This is the required gate for every branch. All four pnpm steps must be
exit 0 for the job to pass.

## `.github/workflows/nightly.yml` — Pi5 smoke

Triggers: `cron: "0 7 * * *"` UTC and `workflow_dispatch`.

Runner: `[self-hosted, argent-lite, pi5]` — must be registered manually
(see below). Until a runner is registered, `continue-on-error: true`
keeps the repo from going red on missing hardware.

Steps: `bash scripts/ci-smoke.sh`, which runs the same
install/check/test/build chain as CI plus a real CLI invocation:

```bash
ARGENT_MODE=standalone node dist/src/cli/index.js "ci smoke $(date -Iseconds)"
```

This exercises the standalone runtime against whatever local model stack
is live on the Pi (ollama today, Hailo-10H once installed 2026-04-12).

## Registering a Pi as a self-hosted runner

On the Pi:

```bash
gh runner create \
  --repo ArgentAIOS/argent-lite \
  --labels self-hosted,argent-lite,pi5
```

Follow the prompts to install and enroll the runner as a systemd service.
Verify with `gh runner list --repo ArgentAIOS/argent-lite`.

Until then, the nightly job will skip cleanly on "no runner available"
without marking the workflow failed.

## Debugging a red build

1. `gh run list --branch <branch> --limit 5`
2. `gh run view <run-id> --log-failed`
3. Reproduce locally with the exact command that failed
   (`pnpm install --frozen-lockfile`, `pnpm check`, etc.)
4. Never bypass the gate — fix the code or the workflow, then push.

## Ground rules

- CI must be green before any merge into `main` or `develop`.
- Never use `--no-verify`, `continue-on-error`, or branch protection
  overrides on `main`/`develop` to ship a red build.
- Nightly failures on the Pi are informational until the runner is
  registered and Hailo hardware is live.
