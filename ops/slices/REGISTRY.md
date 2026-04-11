# Slice Registry

## Active Slices

| Slice | Branch | Owner | Files / Surface | Started | Status |
| --- | --- | --- | --- | --- | --- |
| ops-team-bootstrap | codex/ops-team-bootstrap | threadmaster | integration branch | 2026-04-11 | integration-live |
| phase1-review | codex/phase1-review | reviewer | read-only except ops/team/outbox/reviewer.md | 2026-04-11 | in-progress |

## Completed Slices

| Slice | Branch | PR | Completed | Notes |
| --- | --- | --- | --- | --- |
| argent-lite-scope-decision | codex/ops-team-bootstrap | — | 2026-04-11 | Phase 1 approved by operator |
| project-floor | codex/project-floor | #1 | 2026-04-11 | pnpm+TS+vitest scaffold |
| provider-auth | codex/provider-auth | #3 | 2026-04-11 | AES-256-GCM file backend + env backend |
| model-router-lite | codex/model-router-lite | #4 | 2026-04-11 | ModelRouter + ollama/anthropic/openai adapters |
| cli-scaffold | codex/cli-scaffold | #2 | 2026-04-11 | CLI + mode loader + phase1-design.md |
| hailo-provider-stub | codex/hailo-provider-stub | #5 | 2026-04-11 | HailoProvider stub + router health endpoint |
| agent-topology-lite | codex/agent-topology-lite | #6 | 2026-04-11 | Phase 2 gate planning doc (129 lines) |
| satellite-protocol-stub | codex/satellite-protocol-stub | #7 | 2026-04-11 | Satellite client/server transport + framing |
| ci-harness | codex/ci-harness | #8 | 2026-04-11 | GitHub Actions CI + e2e integration harness |

## Integration status

Cycle-4 integration on codex/ops-team-bootstrap:

- pnpm install — exit 0
- pnpm check   — exit 0
- pnpm test    — **59/59 passing across 11 test files**
- pnpm build   — exit 0

Phase 1 + Phase-2 prep are both live. Next natural gates:
- Open Phase 2 sub-slices (src/agents/**, src/scheduler/**) per `ops/projects/agent-topology-lite.md` once operator approves.
- Real Hailo integration once hardware arrives (2026-04-12).
- Satellite protocol secrecy (bearer auth mandatory, TLS) before off-box use.
