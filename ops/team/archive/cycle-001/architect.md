I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision Summary

Argent Lite should bootstrap with a minimal runtime core: the model router and provider auth/credential storage are IN because standalone mode cannot function without them. The 18-agent department structure and contemplation engine are OUT — they assume compute headroom that a Pi 5 does not have. Everything else is DEFER until the team lead opens the real research slice and the satellite-vs-standalone runtime boundary is better understood.

## Subsystem Verdicts

| Subsystem | Verdict | Rationale |
| --- | --- | --- |
| **Channels** (Slack, email, web, CLI) | **DEFER** | CLI is the natural first interface for a headless Pi, but which other channels port depends on satellite-vs-standalone split. Deciding now would lock in surface area before mode boundaries are clear. (`ops/runbooks/research-planning.md` §4: "what should be adopted" vs. "what should explicitly not be adopted" — insufficient data to answer yet.) |
| **Agent department structure** (18-agent model) | **OUT** | The 18-agent model is designed for a Mac with ample RAM and multiple concurrent LLM contexts. A Pi 5 with 16 GB and a single Hailo accelerator cannot host that fan-out. A lighter agent model must be designed from scratch for Lite. (`ops/CLAUDE.md`: "Scope of what actually ports from argentos-core … is not yet decided — that is an early research slice, not an implementation slice.") |
| **MemU memory layer** | **DEFER** | Memory is downstream of the agent model. Until the Lite agent topology is decided, porting MemU risks carrying abstractions that don't fit. (`ops/runbooks/research-planning.md` §4: research must determine "where the current project is stronger.") |
| **Contemplation engine** | **OUT** | Contemplation is a compute-intensive background process. On a CPU-bound Pi (pre-Hailo and even post-Hailo for LLM inference), it would starve foreground tasks. Not viable for either deployment mode today. |
| **Intent system** | **DEFER** | Intent routing is valuable but tightly coupled to the agent structure. Cannot be evaluated independently. Revisit after the agent topology slice. |
| **Model router** | **IN** | Essential for standalone mode: the router decides whether a request goes to the local LLM (ollama/Hailo) or to a cloud provider (Anthropic, OpenAI). Without it, standalone mode has no way to dispatch work. This is the minimum viable runtime decision. (`ops/projects/ACTIVE.md`: standalone mode requires "local LLM + cloud provider API/auth.") |
| **React dashboard vs. headless** | **OUT** (dashboard) / **IN** (headless) | The Pi's primary interface should be headless (CLI + API). A React dashboard adds a build toolchain, a web server, and browser-facing attack surface for no clear gain on a device that may not have a display. Headless-first; dashboard can be layered later if needed. (`ops/CLAUDE.md`: "zero application code in this repo today" — adding a frontend framework before a backend exists inverts the dependency.) |
| **Provider auth + credential storage** | **IN** | New requirement with no argentos-core precedent. Standalone mode must authenticate to cloud providers. This is greenfield design, not a port, and must be addressed before any cloud-routed request can work. (`ops/projects/ACTIVE.md`: "cloud provider API/auth" is explicit scope.) |

## Rationale (cited sources)

- `ops/CLAUDE.md` — confirms zero application code, two deployment modes, and that scope is an open research question.
- `ops/projects/ACTIVE.md` — "Argent Lite Scope Decision" is `planned` and `unassigned`; this memo feeds that decision.
- `ops/runbooks/research-planning.md` §4 — research must answer where each system is stronger/weaker and what to adopt.
- `ops/runbooks/slice-management.md` §8 — planning slices must not be treated as implementation.
- `ops/rules/never-do.md` — "Never auto-implement feature requests"; this memo proposes, it does not build.

## Risks and Non-Goals

**Risks:**
- The IN calls (model router, provider auth) are intentionally narrow. If the team lead wants a broader initial scope, this memo should be revised before any slice is opened.
- The DEFER items assume a follow-on research slice will be opened promptly. If that slice stalls, the DEFER verdicts become implicit OUTs by default.
- The Mac-station patrol model in existing runbooks does not map to a Pi-only deploy (`ops/CLAUDE.md` §Mac-station mismatch). Any subsystem that assumes two-station orchestration needs adaptation, not direct porting.

**Non-goals of this memo:**
- Implementation design for any subsystem.
- Claiming or starting the `argent-lite-scope-decision` slice.
- Deciding the satellite ↔ standalone protocol boundary (that is a separate research question).
- Evaluating Hailo-10H hardware capabilities (hardware arrives 2026-04-12; premature to design around it).

## Recommended Follow-On Slices

- `argent-lite-scope-decision` — the real research slice; takes this memo as input, produces binding IN/OUT list and phase plan.
- `provider-auth-design` — greenfield design for credential storage and cloud-provider authentication in standalone mode.
- `model-router-lite` — adapt or rewrite the model router for local-LLM + cloud-provider dispatch on constrained hardware.
- `agent-topology-lite` — design a lightweight agent model that fits Pi 5 resource constraints (feeds DEFER items: MemU, intent, channels).

## Files Touched

`ops/team/outbox/architect.md` only (this file).

## Contract Reference

`ops/contracts/architect.contract.md` — Task 001.

## Blockers / Open Questions

None blocking this memo. The follow-on slice `argent-lite-scope-decision` should be opened and assigned before DEFER items age out.
