# Branching & Merge Rules

## Branch Naming

| Prefix | Purpose | Example |
| --- | --- | --- |
| `codex/*` | Implementation work | `codex/runtime-guard` |
| `fix/*` | Focused bug fix | `fix/install-regression` |
| `feat/*` | Product feature | `feat/new-provider` |
| `salvage/*` | Backup of risky local state | `salvage/pre-cleanup-20260331` |

`develop` is the private integration branch for release-facing work.
`main` is the stable release trunk. Never develop directly on it.

## Merge Rules

1. All work happens on `codex/*` or another approved implementation branch.
2. Validate release-facing work before any recommendation to merge.
3. Merge release-facing implementation into `develop` first unless the owner explicitly overrides this.
4. Operator or human smoke testing happens after validation and before `main`.
5. Promote `develop` to `main` only after regression testing and operator sign-off.
6. Use fast-forward merges when possible.
7. If fast-forward fails, rebase onto the target branch first.

## Worktree Rules

1. Primary dev workspace: `/home/jason/code/argent-lite`
2. Never have two worktrees on the same branch.
3. Document every worktree in `ops/slices/REGISTRY.md`.

**Note:** Clean-lane worktrees (`/home/jason/code/argent-lite-develop-clean`
and `/home/jason/code/argent-lite-main-clean`) are optional for this Pi
deploy. They can be created later if the project needs isolated clean-lane
validation, but are not required for single-machine operation.
