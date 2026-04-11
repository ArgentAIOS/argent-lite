# Slice Registry

## Active Slices

| Slice | Branch | Owner | Files / Surface | Started | Status |
| --- | --- | --- | --- | --- | --- |
| ops-team-bootstrap | codex/ops-team-bootstrap | threadmaster | ops/**, src/**, tests/** (integration branch) | 2026-04-11 | integration-live |
| phase1-review | codex/phase1-review | reviewer | read-only except ops/team/outbox/reviewer.md | 2026-04-11 | in-progress |

## Completed Slices

| Slice | Branch | Owner | Files / Surface | Completed | Notes |
| --- | --- | --- | --- | --- | --- |
| argent-lite-scope-decision | codex/ops-team-bootstrap | architect | ops/projects/argent-lite-scope-decision.md | 2026-04-11 | Phase 1 approved by operator |
| project-floor | codex/project-floor | engineer-floor | package.json, tsconfig.json, vitest.config.ts, .eslint/.prettier, src/index.ts, tests/smoke.test.ts | 2026-04-11 | PR #1 merged into codex/ops-team-bootstrap |
| provider-auth | codex/provider-auth | engineer-auth | src/auth/**, tests/auth/** | 2026-04-11 | PR #3 merged; AES-256-GCM file backend + env backend |
| model-router-lite | codex/model-router-lite | engineer-router | src/router/**, src/providers/**, tests/router/**, tests/providers/** | 2026-04-11 | PR #4 merged; ModelRouter + ollama/anthropic/openai adapters |
| cli-scaffold | codex/cli-scaffold | architect | src/cli/**, src/config/**, tests/cli/**, ops/projects/phase1-design.md | 2026-04-11 | PR #2 merged; integration patch by threadmaster wired CLI to real router |

## Integration status (2026-04-11)

Phase 1 end-to-end on codex/ops-team-bootstrap:

- pnpm install — exit 0
- pnpm check   — exit 0
- pnpm test    — **38/38 passing** across 7 files
- pnpm build   — exit 0
- Live smoke:  `node dist/src/cli/index.js "hello"` returned a real
  response from gemma3:1b via the OllamaProvider through ModelRouter
  (local-first policy).

Phase 1 is functionally live. Next phases (`agent-topology-lite`,
`memory-lite`, `intent-routing-lite`, `channels-lite`) are deferred
pending operator approval per the scope decision document.
