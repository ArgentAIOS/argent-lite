# Argent Lite Development Workflow

## Purpose

Keep day-to-day development stable while preserving a clean path from
implementation branches through `develop` to `main`.

## Prerequisites

If there is no `package.json` in the repo root, the validation commands in
this runbook are inapplicable. Claim the project-floor slice and complete
the scope decision before attempting build/test validation.

## Workspace

All work happens in a single workspace on the Pi:

- `/home/jason/code/argent-lite` — active development, implementation
  branches, integration, and release validation.

Clean-lane worktrees (`-develop-clean`, `-main-clean`) are **optional** and
can be created later if the project grows to need isolated validation. They
are not required for single-machine Pi operation.

## Ground Rules

1. Never do day-to-day edits directly on `main`.
2. All code changes happen on `codex/*` branches.
3. Threadmaster validates release-facing work before recommending merge.
4. Merge release-facing implementation into `develop` first.
5. Promote `develop` to `main` only after regression testing and operator sign-off.

## Release Lane Flow (single-machine)

1. Implement on `codex/*`.
2. Hand off using `ops/runbooks/threadmaster-handoff.md`.
3. Threadmaster validates on a clean checkout of `develop` (stash or commit
   in-progress work first).
4. Merge into `develop`.
5. Build and test the artifact from `develop`.
6. Operator or human performs final smoke validation.
7. Record sign-off.
8. Promote the tested commit from `develop` to `main`.

## Minimum Validation

Run these only when `package.json` exists in the repo root:

```bash
pnpm install
pnpm build
pnpm check
pnpm test
```

Additional project-specific checks (e.g., `pnpm protocol:check`,
`pnpm --dir dashboard build`) apply only when their respective targets
exist. Do not run commands against missing directories or configs.
