# Active Projects

| Project | Owner | Status | Notes |
| --- | --- | --- | --- |
| Maintainer Gate Adoption | threadmaster | in-progress | Ops, intake, and handoff discipline live; multi-agent cycle running |
| Ops Team Bootstrap | threadmaster | in-progress | Contracts/workflows/CLAUDE.md scaffold + 5-agent tmux team for Argent Lite |
| Argent Lite Scope Decision | threadmaster | **approved 2026-04-11** | Operator greenlighted Phase 1 (model router + provider auth, headless, satellite + standalone runtime modes). Document at `ops/projects/argent-lite-scope-decision.md`. |
| Argent Lite Phase 1 Implementation | threadmaster | **complete 2026-04-11** | project-floor, provider-auth, model-router-lite, cli-scaffold, hailo-provider-stub shipped on `codex/ops-team-bootstrap`. |
| Argent Lite Phase 2 Scaffold | threadmaster | **complete 2026-04-11** | Scheduler + agents + MessageBus skeleton (PRs #9–#16) merged; agent-topology-lite gate doc accepted. |
| Argent Lite Phase 3 Implementation | threadmaster | **complete-pending-sign-off 2026-04-11** | Memory + channels + intent router + observability + runtime seam merged at cycle-13 (`codex/ops-team-bootstrap@e683f11`). 189/189 tests green, Phase 3 stub smoke green. Awaiting operator sign-off. |
| Argent Lite Phase 3 Sign-off | threadmaster | pending | Operator smoke against real providers (Hailo-10H lands 2026-04-12); promotes `codex/ops-team-bootstrap` toward `develop`. |

## Operator sign-off log

- **2026-04-11** — Operator approved scope-decision.md phase 1 and authorized autonomous
  execution ("Complete port, testing and functional. 4-5 agents at all times. Long run."),
  delegated to threadmaster for multi-agent orchestration in tmux panes.
