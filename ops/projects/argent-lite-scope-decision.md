# Argent Lite Scope Decision

## Approval

**For operator sign-off.** If approved, the first implementation work is:
**model router + provider auth**, both headless, supporting two runtime
modes (satellite and standalone). The model router dispatches requests to
local LLM (ollama/Hailo) or cloud providers (Anthropic, OpenAI). Provider
auth handles credential storage and cloud-provider authentication for
standalone mode. No frontend, no multi-agent orchestration, no memory
layer ships in this first phase. Approving this document greenlight
phase 1 slices only; later phases require separate operator approval.

---

## Decision Summary

Argent Lite bootstraps with the narrowest viable runtime: model router
and provider auth/credential storage. The 18-agent department structure
and contemplation engine are excluded — they assume compute headroom a
Pi 5 does not have. All other subsystems are deferred until the agent
topology and satellite-vs-standalone protocol boundary are better
understood.

## Scope

### IN (phase 1)

| Subsystem | Rationale |
| --- | --- |
| **Model router** | Essential for standalone mode: dispatches requests to local LLM (ollama/Hailo) or cloud provider. Without it, standalone mode cannot function. (`ops/projects/ACTIVE.md`: standalone requires "local LLM + cloud provider API/auth.") |
| **Provider auth + credential storage** | Greenfield — no argentos-core precedent. Standalone mode must authenticate to cloud providers before any cloud-routed request works. (`ops/projects/ACTIVE.md`: "cloud provider API/auth" is explicit scope.) |
| **Headless runtime** | CLI + API is the natural Pi interface. No display assumed; headless-first keeps the attack surface and dependency tree minimal. (`ops/CLAUDE.md`: "zero application code in this repo today.") |

### DEFER (phase 2+)

| Subsystem | Depends On | Earliest Phase |
| --- | --- | --- |
| Channels (Slack, email, web, CLI) | satellite-vs-standalone protocol boundary | phase 3 |
| MemU memory layer | agent topology design | phase 3 |
| Intent system | agent topology design | phase 3 |

### OUT

| Subsystem | Rationale |
| --- | --- |
| **18-agent department structure** | Designed for Mac with ample RAM and multiple concurrent LLM contexts. Pi 5 with 16 GB and a single Hailo accelerator cannot host that fan-out. A lighter model must be designed from scratch. |
| **Contemplation engine** | Compute-intensive background process. On a CPU-bound Pi it would starve foreground tasks. Not viable for either deployment mode. |
| **React dashboard** | Adds build toolchain, web server, and browser-facing attack surface for no clear gain on a headless device. Can be layered later if needed. |

## Explicit Non-Goals

- Implementation design for any subsystem (this is a planning artifact).
- Deciding the satellite ↔ standalone protocol boundary (separate research question).
- Evaluating Hailo-10H hardware capabilities (hardware arrives 2026-04-12; premature).
- Porting any argentos-core code directly — all Lite code is new or adapted.
- Defining the Lite agent topology (that is its own slice).

## Candidate File Areas

These are the likely file-tree areas for phase 1 implementation. Exact
paths will be defined in each slice's REGISTRY entry.

| Area | Purpose |
| --- | --- |
| `src/router/` | Model router: request dispatch logic, provider selection |
| `src/providers/` | Provider adapters (ollama, Anthropic, OpenAI) |
| `src/auth/` | Credential storage, provider authentication |
| `src/cli/` | Headless CLI entrypoint |
| `config/` | Runtime mode config (satellite vs. standalone) |

## Phased Execution Order

### Phase 1 — Minimum viable runtime (ships first)

| Slice | Description | Dependencies |
| --- | --- | --- |
| `provider-auth-design` | Design credential storage and cloud-provider auth for standalone mode | none (greenfield) |
| `model-router-lite` | Design and implement local-LLM + cloud-provider dispatch on constrained hardware | `provider-auth-design` (needs auth interface contract) |

Phase 1 delivers: a headless process that accepts a prompt, routes it to
local ollama or a cloud provider based on configuration, and returns the
response. Two runtime modes (satellite, standalone) are config-driven.

### Phase 2 — Agent topology

| Slice | Description | Dependencies |
| --- | --- | --- |
| `agent-topology-lite` | Design a lightweight agent model that fits Pi 5 resource constraints | phase 1 complete (needs working router) |

Phase 2 delivers: a design document defining how agents are structured,
scheduled, and resource-limited on Pi hardware. This unblocks all DEFER
items.

### Phase 3 — Deferred subsystems (unlocked by phase 2)

| Slice | Description | Dependencies |
| --- | --- | --- |
| `memory-lite` | Adapt or replace MemU for Lite's agent topology | `agent-topology-lite` |
| `intent-routing-lite` | Intent system adapted for Lite's agent model | `agent-topology-lite` |
| `channels-lite` | Channel support starting with CLI, then others as needed | `agent-topology-lite` + satellite/standalone protocol decision |

### Future / unscheduled

| Slice | Description | Trigger |
| --- | --- | --- |
| `satellite-protocol` | Define the federation protocol between Lite and Mac Argent | operator decision on satellite mode priority |
| `hailo-integration` | Hailo-10H accelerator integration for local inference | hardware arrives and is characterized (2026-04-12+) |
| `dashboard-lite` | Optional web dashboard | operator request only |

## Future Slice Breakdown

1. `provider-auth-design` — greenfield credential storage design
2. `model-router-lite` — local + cloud dispatch on Pi hardware
3. `agent-topology-lite` — lightweight agent model for Pi 5
4. `memory-lite` — memory layer adapted to Lite topology
5. `intent-routing-lite` — intent system for Lite agents
6. `channels-lite` — channel support (CLI first)
7. `satellite-protocol` — federation with Mac Argent
8. `hailo-integration` — hardware accelerator support
9. `dashboard-lite` — optional web UI

## Acceptance Criteria

- [ ] Operator approves the approval section above
- [ ] Phase 1 slices (`provider-auth-design`, `model-router-lite`) are opened in REGISTRY after approval
- [ ] Each phase gate requires operator sign-off before proceeding
- [ ] No implementation begins until the relevant design slice is `planning-complete`
- [ ] OUT items remain out unless a new scope decision is issued

## Open Questions

1. **Satellite-vs-standalone protocol boundary** — how does the Pi discover and authenticate to the Mac? This is prerequisite for `satellite-protocol` and affects `channels-lite` scope. Separate research slice needed.
2. **Hailo-10H inference capabilities** — hardware arrives 2026-04-12. Until benchmarked, local LLM routing assumes CPU-only ollama. The `hailo-integration` slice should be opened after characterization.
3. **Credential storage mechanism** — keyring, encrypted file, environment variables, or vault? `provider-auth-design` must evaluate options against Pi constraints (no TPM, limited daemon support).
4. **Ollama model selection** — which models are viable on Pi 5 16 GB with Hailo? Currently `gemma3:1b` and `gemma4:e2b` are pulled. Router needs a model capability map.
