# Slice Registry

## Active Slices

| Slice | Branch | Owner | Files / Surface | Started | Status |
| --- | --- | --- | --- | --- | --- |
| ops-team-bootstrap | codex/ops-team-bootstrap | threadmaster | ops/CLAUDE.md, ops/contracts/, ops/workflows/, ops/team/ | 2026-04-11 | in-progress |
| project-floor | codex/project-floor | engineer-floor | package.json, pnpm-workspace.yaml, tsconfig.json, vitest.config.ts, .eslintrc.cjs, src/index.ts, tests/smoke.test.ts | 2026-04-11 | in-progress |
| provider-auth | codex/provider-auth | engineer-auth | src/auth/**, tests/auth/** | 2026-04-11 | in-progress |
| model-router-lite | codex/model-router-lite | engineer-router | src/router/**, src/providers/**, tests/router/** | 2026-04-11 | in-progress |
| cli-scaffold | codex/cli-scaffold | architect | src/cli/**, src/config/**, tests/cli/** — design+scaffold | 2026-04-11 | in-progress |
| phase1-review | codex/phase1-review | reviewer | read-only except ops/team/outbox/reviewer.md | 2026-04-11 | in-progress |

## Completed Slices

| Slice | Branch | Owner | Files / Surface | Completed | Notes |
| --- | --- | --- | --- | --- | --- |
| argent-lite-scope-decision | codex/ops-team-bootstrap | architect | ops/projects/argent-lite-scope-decision.md | 2026-04-11 | Phase 1 approved by operator |

## Notes on multi-slice parallelism (2026-04-11)

Five slices run in parallel on distinct surfaces to satisfy the
operator's "4-5 agents at all times" mandate. Each engineer slice owns a
disjoint subtree under `src/`; the architect owns design + CLI
scaffolding; the reviewer is read-only. Cross-slice integration happens
via threadmaster merge after each slice lands its own commit on its
child branch. Child branches rebase onto `codex/ops-team-bootstrap`
before integration.
