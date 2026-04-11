# Slice Registry

## Active Slices

| Slice | Branch | Owner | Files / Surface | Started | Status |
| --- | --- | --- | --- | --- | --- |
| ops-team-bootstrap | codex/ops-team-bootstrap | threadmaster | integration branch | 2026-04-11 | integration-live |
| phase3-registry-update | codex/phase3-registry-update | engineer-floor | ops/slices/REGISTRY.md, ops/projects/ACTIVE.md, ops/team/JOURNAL.md, README.md, ops/team/outbox/engineer-floor.md | 2026-04-11 | in-progress |

## Completed Slices

| Slice | Branch | PR | Completed | Notes |
| --- | --- | --- | --- | --- |
| argent-lite-scope-decision | codex/ops-team-bootstrap | — | 2026-04-11 | Phase 1 approved by operator |
| project-floor | codex/project-floor | #1 | 2026-04-11 | pnpm+TS+vitest scaffold |
| cli-scaffold | codex/cli-scaffold | #2 | 2026-04-11 | CLI + mode loader + phase1-design.md |
| provider-auth | codex/provider-auth | #3 | 2026-04-11 | AES-256-GCM file backend + env backend |
| model-router-lite | codex/model-router-lite | #4 | 2026-04-11 | ModelRouter + ollama/anthropic/openai adapters |
| hailo-provider-stub | codex/hailo-provider-stub | #5 | 2026-04-11 | HailoProvider stub + router health endpoint |
| agent-topology-lite | codex/agent-topology-lite | #6 | 2026-04-11 | Phase 2 gate planning doc (129 lines) |
| satellite-protocol-stub | codex/satellite-protocol-stub | #7 | 2026-04-11 | Satellite client/server transport + framing |
| ci-harness | codex/ci-harness | #8 | 2026-04-11 | GitHub Actions CI + e2e integration harness |
| ci-live | codex/ci-live | #9 | 2026-04-11 | Nightly Pi smoke + CI docs |
| scheduler-skeleton | codex/scheduler-skeleton | #10 | 2026-04-11 | Scheduler + TaskQueue + SchedulableAgent types |
| agent-skeleton | codex/agent-skeleton | #11 | 2026-04-11 | BaseAgent + MessageBus + AgentContext |
| agent-lifecycle-design | codex/agent-lifecycle-design | #13 | 2026-04-11 | Phase 2 agent↔scheduler interface contract |
| agent-helloagent | codex/agent-helloagent | #14 | 2026-04-11 | HelloAgent end-to-end over MessageBus |
| context-router-bridge | codex/context-router-bridge | #15 | 2026-04-11 | Optional agent→router bridge + default router |
| demo-runner | codex/demo-runner | #16 | 2026-04-11 | Scheduler + HelloAgent demo runner |
| memory-lite-design | codex/memory-lite-design | #17 | 2026-04-11 | Phase 3 memory gate planning doc |
| router-agent | codex/router-agent | #18 | 2026-04-11 | RouterAgent wired to MessageBus + router |
| hailo-bootstrap | codex/hailo-bootstrap | #19 | 2026-04-11 | Setup probes + probeHailo() runtime |
| channels-lite-design | codex/channels-lite-design | #20 | 2026-04-11 | Phase 3 channel model + 3 built-ins |
| memory-store-impl | codex/memory-store-impl | #21 | 2026-04-11 | SqliteMemoryStore on node:sqlite |
| channel-cli-stdio | codex/channel-cli-stdio | #22 | 2026-04-11 | CliStdioChannel with injected stdin/stdout |
| memory-retention | codex/memory-retention | #23 | 2026-04-11 | withRetention wrapper (TTL + event cap) |
| router-agent-live | codex/router-agent-live | #24 | 2026-04-11 | e2e runner wires RouterAgent to default router |
| phase3-integration-plan | codex/phase3-integration-plan | #25 | 2026-04-11 | Wire memory + channels + router-agent |
| obs-metrics | codex/obs-metrics | #26 | 2026-04-11 | Counters + bounded-ring histograms |
| obs-logger | codex/obs-logger | #27 | 2026-04-11 | Structured JSON logger (Phase 3 observability) |
| router-metrics-wiring | codex/router-metrics-wiring | #28 | 2026-04-11 | instrumentRouter wrapper |
| observability-design | codex/observability-design | #29 | 2026-04-11 | Local-only obs seam for Phase 3 |
| agent-trace-context | codex/agent-trace-context | #30 | 2026-04-11 | Trace id helpers |
| satellite-auth-hardening | codex/satellite-auth-hardening | #31 | 2026-04-11 | HMAC + bearer requireAuth |
| channel-http | codex/channel-http | #32 | 2026-04-11 | HttpChannel with POST /v1/prompt |
| intent-routing-design | codex/intent-routing-design | #33 | 2026-04-11 | Phase 3 intent router planning doc |
| intent-router-impl | codex/intent-router-impl | #34 | 2026-04-11 | createIntentRouter + tests |
| memory-observed-router | codex/memory-observed-router | #35 | 2026-04-11 | withMemoryLog router wrapper |
| instrumented-cli | codex/instrumented-cli | #36 | 2026-04-11 | instrumentedMain CLI with logger/metrics wiring |
| phase3-acceptance | codex/phase3-acceptance | #37 | 2026-04-11 | Phase 3 done-definition + acceptance smoke test |
| event-kind-lock | codex/event-kind-lock | #38 | 2026-04-11 | Lock runtime event-kind vocabulary to 5 values |
| phase3-e2e-test | codex/phase3-e2e-test | #39 | 2026-04-11 | stub-provider + cli-chat integration harness |
| agent-context-memory | codex/agent-context-memory | #40 | 2026-04-11 | Require MemoryStore on AgentContext |
| phase3-runtime-slice | codex/phase3-runtime-slice | #41 | 2026-04-11 | bootRuntime() + argent chat wiring |
| event-kind-reconcile | codex/event-kind-reconcile | #42 | 2026-04-11 | Unify runtime vocabulary on cycle-12 lock |
| phase3-smoke-script | codex/phase3-smoke-script | #43 | 2026-04-11 | Reproducible runtime smoke + vitest wrapper + docs |
| phase3-bugfix-plan | codex/phase3-bugfix-plan | #44 | 2026-04-11 | Architect decision memo for cycle-13 smoke bugs |
| runtime-bus-wiring-fix | codex/runtime-bus-wiring-fix | #45 | 2026-04-11 | Deliver prompts to RouterAgent in bootRuntime |

## Integration status

Cycle-13 integration on codex/ops-team-bootstrap (commit e683f11):

- pnpm install — exit 0
- pnpm check   — exit 0
- pnpm test    — **189/189 passing**
- pnpm build   — exit 0
- Phase 3 stub smoke — green

Phase 3 is structurally complete pending operator sign-off. Next natural
gates:

- Phase 3 sign-off (operator smoke against real providers once Hailo-10H
  lands 2026-04-12).
- Pi load constraint: cycle fan-out capped at 5 concurrent engineer panes
  to keep Pi thermals sane.
- Real Hailo integration once hardware arrives 2026-04-12.
