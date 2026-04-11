# Agent Lifecycle Design — Phase 2 Interface Contract

**Status:** planning-complete · **Slice:** `agent-lifecycle-design` ·
**Branch:** `codex/agent-lifecycle-design` · **Owner:** architect ·
**Parent:** `ops/projects/agent-topology-lite.md` ·
**Consumers:** engineer-auth (`src/agents/**`), engineer-router (`src/scheduler/**`).

## Decision summary

One agent is a long-lived object owned by the `Scheduler`, moving through
a fixed 5-state lifecycle driven by scheduler calls and hook completion.
The scheduler injects a single `AgentContext` bag at `start()` and
enforces `AbortController`-based hard limits; agents never touch
providers, clocks, or credentials directly.

## Lifecycle states

```
   register()       start()       tick()/msg       suspend()
init ────────► ready ──────► running ◄─────────► suspended
                 ▲             │    │               │
                 │             │    │ stop()/throw  │ stop()
                 └─── resume() ┘    ▼               ▼
                                  stopped  ◄────────┘
```

- `init` → constructed, `onInit()` pending. Set by `register()`.
- `ready` → `onInit()` resolved. Targets: `running`, `stopped`.
- `running` → inside `tick()`/message handler. Targets: `ready`, `suspended`, `stopped`.
- `suspended` → paused. Targets: `running`, `stopped`.
- `stopped` → terminal. `onStop()` has run.

`init → ready` and `running → ready` are **async** (await hook); other
transitions are synchronous state writes guarded by the scheduler.
Illegal transitions throw `AgentStateError`.

## Interface signatures (TS-ish)

```ts
type AgentId = string;
type AgentState = "init" | "ready" | "running" | "suspended" | "stopped";
type StopReason = "requested" | "error" | "timeout" | "mem" | "shutdown";

interface ResourceLimits {
  maxMemMb: number;              // soft warn (heapUsed sampler)
  maxWallMs: number;             // hard kill via AbortController
  maxConcurrentRouterCalls: number;
}

interface AgentContext {
  id: AgentId;
  logger: Logger;                // scoped child logger
  router: Router;                // src/router — only route(req)
  credentials: CredentialStore;  // read-only, scoped to agent id
  bus: AgentBusHandle;           // pre-bound `from=id`
  limits: ResourceLimits;
  signal: AbortSignal;           // fires on stop() or limit breach
}

interface AgentMessage {
  id: string; from: AgentId; to: AgentId | "broadcast";
  kind: string; payload: unknown; ts: number;
}

interface Agent {
  readonly id: AgentId;
  readonly descriptor: AgentDescriptor;
  onInit(ctx: AgentContext): Promise<void>;
  onMessage(msg: AgentMessage): Promise<void>;
  tick(): Promise<void>;                    // cooperative step, ≤maxWallMs
  onStop(reason: StopReason): Promise<void>;
}

interface AgentDescriptor {
  id: AgentId; kind: string; limits: ResourceLimits; state: AgentState;
}

interface Scheduler {
  register(agent: Agent): void;             // init → ready (async settle)
  start(id: AgentId): Promise<void>;        // ready → running
  stop(id: AgentId, reason?: StopReason): Promise<void>;
  suspend(id: AgentId): Promise<void>;
  resume(id: AgentId): Promise<void>;
  list(): AgentDescriptor[];
  tick(): Promise<void>;                    // deterministic: drains one pass
}
```

## Sequence (scheduler → agent → router round-trip)

```
Caller      Scheduler          Agent(worker)       Router
  │ start(id)│                     │                 │
  │─────────►│ onInit(ctx) ───────►│                 │
  │          │◄──── ready ─────────│                 │
  │ tick()   │ state=running       │                 │
  │─────────►│ onMessage(msg) ────►│                 │
  │          │                     │ ctx.router.route(req) ──►│
  │          │                     │◄──── CompletionResponse ─│
  │          │                     │ bus.publish(result)      │
  │          │◄──── tick resolves ─│                 │
  │◄── done ─│ state=ready         │                 │
```

Abort path: if `maxWallMs` elapses, scheduler fires `ctx.signal.abort()`;
router call rejects with `AbortError`; `tick()` rejects; scheduler
transitions `running → stopped` with `reason="timeout"`.

## Resource limit enforcement

- **`maxWallMs`** (hard): per-tick `AbortController` armed at `tick()` entry; agents propagate `ctx.signal` into every `router.route()`.
- **`maxMemMb`** (soft): pool samples `process.memoryUsage().heapUsed` between ticks; breach ⇒ warn + `running → suspended`. Global `--max-old-space-size` is the real guardrail.
- **`maxConcurrentRouterCalls`** (hard): `ctx.router` wrapped in a per-agent `p-limit(n)` at `start()`; excess calls queue, never reject.

## Failure semantics

| Failure                     | Effect                                                  |
| --------------------------- | ------------------------------------------------------- |
| `onInit` throws             | `init → stopped`, `reason="error"`, removed from pool. |
| `tick()`/`onMessage` throws | Isolated, logged, `running → ready`; 3 throws / 60s ⇒ `stopped`. |
| Wall-clock exceeded         | `abort()`, `running → stopped`, `reason="timeout"`.    |
| Mem sampler breach          | `running → suspended`, `reason="mem"`; operator may `resume()`. |
| Event-loop block (no await) | Detected as missed tick deadline; treated as timeout.  |
| Router rejection            | Bubbles to agent; unhandled ⇒ tick-throw path above.   |

Every stop publishes `{kind:"agent.stopped", payload:{id,reason}}` on the bus.

## Test acceptance criteria

**engineer-auth (`src/agents/**`):**
1. `BaseAgent` enforces the 5-state machine; illegal transition throws `AgentStateError`.
2. `onInit` rejection lands the agent in `stopped`/`error`.
3. Aborting `ctx.signal` causes an in-flight `tick()` to reject with `AbortError`.
4. Messages `to: id` delivered FIFO per sender.
5. `onStop` runs exactly once per agent, even under double `stop()`.

**engineer-router (`src/scheduler/**`):**
1. `register → start → tick → stop` round-trip passes for a stub agent.
2. `tick()` is deterministic: fixed bus state ⇒ identical `list()` output across runs.
3. `maxWallMs=10` forces `stop`/`timeout` on a sleeping agent.
4. `maxConcurrentRouterCalls=1` serializes two parallel `route()` calls.
5. Concurrency cap of 3 holds under 10 registered agents (4th waits).
6. A thrown `tick()` isolates to one agent; siblings keep running.

## Open questions

1. **Suspended-agent inbox** — buffer (bounded 64) vs drop? Lean: buffer.
2. **Heap sampler cadence** — per-tick vs 1 Hz timer; defer to engineer-router.
3. **`limits` mutability** — frozen at `start()` for Phase 2; revisit with `channels-lite`.
4. **Broadcast back-pressure** — no cap today; follow-up in `agent-bus-lite`.
