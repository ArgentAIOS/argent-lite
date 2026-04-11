# Argent Lite Development Workflow

## Purpose

Keep day-to-day development stable while preserving a clean `develop`
lane for integration and a clean `main` lane for release validation.

## Canonical Working Layout

- `/home/jason/code/argent-lite`
  - active development workspace
  - may be dirty and in-progress
- `/home/jason/code/argent-lite-develop-clean`
  - clean integration and dev/release lane
  - branch: `develop`
  - must stay clean
- `/home/jason/code/argent-lite-main-clean`
  - clean trunk validation lane
  - branch: `main`
  - must stay clean

## Ground Rules

1. Never do day-to-day edits directly on `main`.
2. All code changes happen on `codex/*` branches.
3. Threadmaster reconstructs release-facing work in a clean dev/release lane before recommending merge.
4. Merge release-facing implementation into `develop` first.
5. Promote `develop` to `main` only after regression testing and operator sign-off.
6. Validate release and smoke checks from clean worktrees, not from a dirty dev tree.

## Release Lane Flow

1. Implement on `codex/*`
2. Hand off using `ops/runbooks/threadmaster-handoff.md`
3. Threadmaster reconstructs and validates in a clean dev/release lane
4. Merge into `develop`
5. Build and test the dev artifact from `develop`
6. Hand the clean lane to the operator or human for final smoke validation
7. Record sign-off
8. Promote the tested commit from `develop` to `main`

## Minimum Validation

Run the most direct checks for the touched surface. The default baseline is:

```bash
pnpm install
pnpm build
pnpm check
pnpm test
pnpm protocol:check
pnpm --dir dashboard build
```
