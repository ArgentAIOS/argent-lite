# Agent Topology Lite — Phase 2 Planning

**Status:** planning-complete · **Slice:** `agent-topology-lite` ·
**Branch:** `codex/agent-topology-lite` · **Owner:** architect ·
**Parent scope:** `ops/projects/argent-lite-scope-decision.md` ·
**Gates:** Phase 3 (`memory-lite`, `intent-routing-lite`, `channels-lite`).

## Decision summary

Argent Lite runs a **single-process, event-loop agent pool** on the Pi 5:
at most **3 concurrent agents**, scheduled cooperatively in the Node main
thread, talking over an **in-process typed EventEmitter bus** with
best-effort delivery. Heavy or blocking work (Hailo inference, long tool
calls) is delegated to the existing `ModelRouter` — agents never spawn
their own providers. Satellite mode pins everything except an
`edge-intent` triage agent to the Mac; standalone mode runs the full
three-agent set locally.

## Scope

### IN (Phase 2)

| Item | Why |
| --- | --- |
| `AgentRuntime` abstraction (lifecycle, timeout, crash isolation via `try`/`AbortSignal`) | Minimum surface every agent needs |
| Cooperative scheduler (`p-limit`-style, concurrency=3, per-agent wall-clock budget) | Fits single-threaded Node on a Pi; no thread/IPC overhead |
| Typed in-proc `AgentBus` (EventEmitter wrapper, best-effort, no persistence) | Simplest contract that still survives Phase 3 swap to SQLite queue |
| Three seed agents: `triage`, `worker`, `reflector` (names only — implementation is a later slice) | Smallest set that exercises the contract end-to-end |
| Satellite-mode delegation stub: a `RemoteAgentProxy` that forwards a request envelope to the Mac over the (future) satellite protocol | Forces the topology to stay protocol-agnostic |
| Integration point: every agent consumes `ModelRouter` via constructor injection, never instantiates providers directly | Keeps router policy (`local-first`/`cost`) as the single dispatch choke point |

### OUT

| Item | Why |
| --- | --- |
| `worker_threads`, `child_process`, or cluster fan-out | Memory cost + IPC serialization dwarfs the win on a 16 GB Pi with Hailo as the real bottleneck |
| Persistent queue, at-least-once delivery, dead-letter handling | Over-engineering before Phase 3 needs it; revisit in `memory-lite` |
| Multi-tenant agent isolation / sandboxing | Single-operator device; not a security boundary |
| Agent-to-agent direct RPC | Everything goes through the bus; no backchannels |
| Any port of the argentos-core 18-agent department tree | Explicitly OUT per scope decision |

### DEFER

| Item | Depends on | Earliest |
| --- | --- | --- |
| SQLite-backed durable bus | `memory-lite` schema | Phase 3 |
| Intent-driven agent selection | `intent-routing-lite` | Phase 3 |
| Channel-sourced agent input | `channels-lite` | Phase 3 |
| Hailo-aware scheduling hints | `hailo-integration` + benchmarks | post-2026-04-12 |

## Explicit non-goals

- No implementation code in this slice — planning only.
- No decision on the satellite ↔ Mac wire protocol (that is `satellite-protocol`).
- No memory/state design — agents are stateless across ticks; persistence is `memory-lite`'s problem.
- No Hailo-specific scheduling — agents request a route, the router decides the provider.
- No retry semantics beyond "caller may re-dispatch on `AgentError`".

## Candidate file areas

| Path | Purpose |
| --- | --- |
| `src/agents/runtime.ts` | `AgentRuntime` interface + base class (lifecycle, abort, error surface) |
| `src/agents/bus.ts` | Typed `AgentBus` over EventEmitter; best-effort `publish`/`subscribe` |
| `src/agents/types.ts` | `AgentId`, `AgentMessage`, `AgentEnvelope`, `AgentError` |
| `src/agents/triage.ts` | Seed agent: classifies an incoming request, decides local vs. remote |
| `src/agents/worker.ts` | Seed agent: executes a routed `CompletionRequest` via injected `Router` |
| `src/agents/reflector.ts` | Seed agent: post-hoc summary hook (no memory writes yet) |
| `src/agents/remote-proxy.ts` | Satellite-mode stub: serializes an envelope for later transport |
| `src/scheduler/pool.ts` | Concurrency-limited cooperative pool (max 3, per-task timeout) |
| `src/scheduler/policy.ts` | Satellite-vs-standalone pinning decisions |
| `tests/agents/**` | Unit tests for runtime, bus, pool, each seed agent |

## Inter-agent contract

- **Envelope shape** (indicative, fixed in the runtime slice):
  `{ id: string; from: AgentId; to: AgentId | "broadcast"; kind: string; payload: unknown; deadline?: number }`.
- **Delivery:** best-effort, in-order per `(from,to)` pair, no persistence, no ack.
- **Transport:** in-process `AgentBus` (EventEmitter). Remote recipients go via `RemoteAgentProxy`, which returns the same `Promise<AgentResponse>` shape so callers never branch on locality.
- **Errors:** thrown `AgentError` with `code` (`timeout`/`aborted`/`router`/`bus`) — never swallowed, always surfaced to the scheduler.
- **Router access:** agents receive a `Router` (from `src/router`) in their constructor and call `route(req)`; they never import providers.

## Topology by mode

| Agent | Satellite mode | Standalone mode |
| --- | --- | --- |
| `triage` | **Local on Pi** — classify, route remote-heavy work to Mac | Local |
| `worker` | **Remote (Mac)** via `RemoteAgentProxy` | Local, uses `ModelRouter` local-first |
| `reflector` | **Remote (Mac)** | Local, runs only if budget remains |

The pinning decision lives in `src/scheduler/policy.ts` and reads the
runtime mode from config — it is **not** baked into the agents.

## Phased execution order (Phase 2 sub-slices)

1. `agent-runtime-lite` — `AgentRuntime`, `types.ts`, unit tests. No bus, no pool.
2. `agent-bus-lite` — in-proc typed bus + tests. Depends on 1.
3. `agent-scheduler-lite` — cooperative pool with concurrency=3 and per-task timeout. Depends on 1.
4. `agent-seeds-lite` — `triage` + `worker` + `reflector` wired to `ModelRouter`. Depends on 1–3.
5. `agent-remote-proxy-lite` — satellite stub; no wire protocol yet, just the local seam. Depends on 1, 2.
6. `agent-topology-integration` — end-to-end smoke in both modes. Depends on all above.

Each sub-slice is its own branch and its own PR. Threadmaster opens them
one at a time; no parallel implementation until 1 is merged.

## Acceptance criteria (for this planning doc)

- [x] File is ≤200 lines.
- [x] Covers inbox questions 1–5 (agent count, scheduler, isolation, router consumption, mode split, contract, file areas, Phase 3 unblock).
- [x] Lists IN/OUT/DEFER, non-goals, candidate files, sub-slice order, open questions.
- [ ] Operator/threadmaster signs off before any `agent-*-lite` implementation branch opens.
- [ ] REGISTRY entry for this slice set to `planning-complete`.

## Phase 3 unblock conditions

Before `memory-lite`, `intent-routing-lite`, or `channels-lite` may open:

1. Sub-slices 1–4 above are merged (runtime, bus, scheduler, seed agents).
2. A passing smoke test shows a request flowing `triage → worker → router → response` in standalone mode on the Pi.
3. The `AgentEnvelope` shape is frozen (any later change is a breaking slice).
4. `src/scheduler/policy.ts` exposes a mode selector that Phase 3 slices can read without importing agent internals.

## Open questions

1. **Per-agent memory cap.** Node has no cheap per-async-context memory limit. Do we settle for a global `--max-old-space-size` and a wall-clock budget, or add a `heapUsed` sampler in the pool? (Recommendation: wall-clock + global heap cap for Phase 2; revisit if Hailo workloads push RSS.)
2. **Crash recovery granularity.** If one agent throws, does the pool kill just that task or drain the tick? (Recommendation: isolate the task, log, continue.)
3. **`reflector` budget.** Is it allowed to call the router, or is it strictly a local summarizer? Affects Phase 1 router load on Pi CPU.
4. **Satellite authentication.** `RemoteAgentProxy` needs *some* auth stub even if the wire protocol is deferred — does it reuse `src/auth` credential storage or wait for `satellite-protocol`? (Leaning: reuse, to avoid a second credential store.)
5. **Mac-station runbooks.** The two-station patrol model in `ops/CLAUDE.md` still does not map to this Pi deploy; Phase 2 sub-slices should not inherit that assumption. Flag to threadmaster.
