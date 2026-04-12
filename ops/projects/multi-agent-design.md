# Multi-Agent Design — Concurrent Fan-Out on Pi

**Status:** planning · **Slice:** `multi-agent-design` ·
**Branch:** `codex/multi-agent-design` · **Owner:** architect ·
**Parents:** `agent-lifecycle-design.md`, `agent-topology-lite.md` ·
**Consumers:** engineer-scheduler (`src/scheduler/**`), engineer-agents (`src/agents/**`).

## Decision summary

Keep `Scheduler` as today's single-pass dispatcher for one-shot tasks, and
introduce a new `MultiAgentScheduler` in `src/scheduler/multi.ts` that owns
long-lived agents, enforces a `maxConcurrent` ceiling on **running** agents,
respects task priority, and isolates per-agent failures. `BaseAgent` gains
concurrent-safe `start()` (idempotent + re-entrant guard). Cross-agent
delivery extends `MessageBus` with `broadcast` + `reply-to` without
breaking existing `to:id` semantics.

## Lifecycle extension

- `BaseAgent.start()` today throws if called twice. Multi needs it to be
  **idempotent** while `running` (return the existing run promise).
- Add `runHandle(): Promise<void>` so the scheduler can await many agents
  without racing `start()`. Per-agent `start()` serialized by a `_starting`
  latch; concurrent `start()` across distinct agents is unordered.

## Resource budget

Per-agent limits live on `AgentContext.limits` (see
`agent-lifecycle-design.md`). Multi enforces:

- `maxConcurrentRouterCalls`: per-agent `p-limit(n)` around `ctx.router.route`.
- `maxWallMs`: per-agent `AbortController` armed at `start()` via
  injected `setTimeout`; on fire `ctx.signal.abort()` → `running → stopped`
  / `reason="timeout"`.
- Global ceiling: scheduler refuses a 6th running agent when
  `maxConcurrent=5` (Pi thermal cap from REGISTRY).

## Scheduler upgrades (`src/scheduler/multi.ts`)

```ts
interface MultiSchedulerOptions {
  maxConcurrent?: number;     // default 4; Pi cap 5
  now?: () => number;
  clearTimeout?: typeof clearTimeout;
  setTimeout?: typeof setTimeout;
}

class MultiAgentScheduler {
  register(agent: SchedulableAgent, limits: ResourceLimits): void;
  enqueue(task: ScheduledTask & { priority?: number }): void;
  tick(): Promise<void>;      // deterministic; drains due+priority order
  stop(id?: AgentId, reason?: StopReason): Promise<void>;
  list(): AgentDescriptor[];
  activeCount(): number;
}
```

- **Priority:** `TaskQueue.dequeueDue` today returns FIFO by `runAt`. Add
  an optional `priority` field (higher wins) and extend the queue’s sort
  to `(runAt asc, priority desc, seq asc)`. `seq` is a monotonic counter
  for stability.
- **Ceiling:** `tick()` promotes tasks only while `runningAgents.size <
  maxConcurrent`; excess tasks re-queue unchanged (no starvation because
  `runAt` is unchanged and priority ties are stable).
- **Timers injected:** all `setTimeout`/`clearTimeout` come from options
  so fake-clock tests are deterministic.

## Cross-agent message delivery

Extend `AgentMessage` (compat-safe) and `MessageBus`:

```ts
interface AgentMessage {
  id: string; from: AgentId; to: AgentId | "broadcast";
  kind: string; payload: unknown; ts: number;
  replyTo?: string;           // id of the message we answer
  correlationId?: string;     // inherited by replies
}
```

- **Targeted:** unchanged (`emitter.emit(to, msg)`).
- **Broadcast:** `to === "broadcast"` fans out to every **currently
  subscribed** agent except `from`. Implemented via a separate
  `"broadcast"` event channel; delivery order is registration order.
- **Reply-to:** `bus.reply(origMsg, payload)` constructs a targeted
  message with `to = origMsg.from`, `replyTo = origMsg.id`,
  `correlationId = origMsg.correlationId ?? origMsg.id`. No new plumbing.
- **No back-pressure yet** — broadcast fan-out bounded by number of live
  agents (≤5 on Pi). Follow-up slice `agent-bus-lite` if this changes.

## Failure isolation

- `onMessage` / `run()` rejections are caught in the scheduler, logged,
  and move the offender `running → stopped` / `reason="error"`. Siblings
  keep running.
- `register()` wraps `agent.onMessage` in a try/catch shim so a thrown
  handler cannot propagate through `EventEmitter` to peers.
- Pending tasks of a crashed agent drain as `{kind:"agent.stopped"}` so a
  future supervisor slice can decide retry policy.
- No shared mutable state across agents beyond bus and router (per-call).

## Test strategy (deterministic)

All tests use `vi.useFakeTimers()` + injected `now`/`setTimeout`. No real
sleeps, no `setImmediate` races.

1. `maxConcurrent=2` + 5 tasks across 5 agents → exactly 2 running; 3
   pending; advance one tick → next two promoted.
2. Priority: low-priority task at `runAt=10`, high at `runAt=10` → high
   runs first; stable within equal priority by `seq`.
3. Wall-clock: `maxWallMs=50` + agent awaiting forever → after advancing
   fake clock 50ms, agent is `stopped` / `reason="timeout"`.
4. Failure isolation: one of three agents throws in `onMessage` → other
   two stay `running`; throwing one is `stopped` / `reason="error"`.
5. Broadcast: 3 subscribers → sender excluded, peers receive once each,
   in registration order.
6. Reply-to: `bus.reply(msg, payload)` round-trips `correlationId`.
7. Idempotent start: calling `start()` on a `running` agent returns the
   same run promise (identity compare) and does not re-subscribe.

## Phased sub-slices and dependencies

| # | Slice | Depends on | Surface |
| - | ----- | ---------- | ------- |
| 1 | `multi-scheduler-skeleton` | (none) | `src/scheduler/multi.ts`, `types.ts` priority field |
| 2 | `base-agent-idempotent-start` | 1 | `src/agents/base-agent.ts` |
| 3 | `message-bus-broadcast` | 1 | `src/agents/message-bus.ts`, `types.ts` |
| 4 | `multi-failure-isolation` | 1,2,3 | `src/scheduler/multi.ts` (supervisor) |
| 5 | `multi-wallclock-enforcement` | 1,2 | `src/scheduler/multi.ts` + `AgentContext` limits wiring |
| 6 | `multi-integration-smoke` | 1-5 | `tests/` end-to-end fake-clock harness |

Slice 1 must ship first; 2/3 are parallelizable; 4/5 serialize behind
them; 6 is the gate.

## Risks and non-goals

- **Non-goal:** pre-emption — `maxWallMs` only fires on `await` points.
- **Non-goal:** cross-process fan-out — stays in one Node process.
- **Risk:** broadcast is O(subscribers) per send; fine at ≤5 agents.
- **Risk:** `agent-lifecycle-design.md` specifies a 5-state machine that
  today's `BaseAgent` does not implement. Multi must not expand scope —
  treat current 3-state reality as ground truth; flag gap as follow-on
  `agent-lifecycle-reconcile`.

## Open questions

1. Replace `Scheduler` or live alongside? Lean alongside for one cycle.
2. Priority explicit or kind-derived? Lean explicit integer, default 0.
3. Per-agent task quotas (fairness) — defer.
