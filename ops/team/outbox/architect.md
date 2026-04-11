I have read `ops/` and am operating under contract:
`ops/contracts/architect.contract.md`.

## Decision summary

Introduce `MultiAgentScheduler` in `src/scheduler/multi.ts` alongside the
existing one-shot `Scheduler`. It owns long-lived agents, enforces a
global `maxConcurrent` ceiling, respects task priority, injects timers
for deterministic fake-clock tests, and isolates per-agent failures.
`BaseAgent.start()` becomes idempotent; `MessageBus` gains broadcast +
`reply-to`. Full design in `ops/projects/multi-agent-design.md` (149
lines, within cap).

## Rationale

- `ops/projects/agent-lifecycle-design.md` already defines
  `maxConcurrentRouterCalls`, `maxWallMs`, `AbortSignal`-driven kill,
  and a deterministic `tick()` — multi-agent re-uses that contract.
- `src/scheduler/scheduler.ts` already has a `maxConcurrent` cap on
  in-flight tasks; multi lifts the same invariant to **running agents**
  and adds priority ordering in the queue.
- `src/agents/message-bus.ts` is a thin `EventEmitter` shim; adding a
  `broadcast` channel and `reply()` helper is compat-safe.
- Pi thermal cap from `ops/slices/REGISTRY.md` ("cycle fan-out capped at
  5 concurrent engineer panes") justifies `maxConcurrent` default of 4
  with a hard 5 ceiling.
- `ops/rules/never-do.md` + `ops/rules/branching.md` — design-only slice,
  no runtime code, no cross-surface edits, no main push.

## Files touched

- `ops/projects/multi-agent-design.md` (new, 149 lines)
- `ops/team/outbox/architect.md` (this file)

## Commits

- `multi-agent-design: architect decision memo` on
  `codex/multi-agent-design` (see PR below).

## Validation

- `pnpm check` — exit 0
- `pnpm test` — 239/239 passing
- `pnpm build` — exit 0
- Line cap — 149 ≤ 150

## Recommended follow-on slices (names only)

1. `multi-scheduler-skeleton` — `src/scheduler/multi.ts` + priority field.
2. `base-agent-idempotent-start` — re-entrant `start()` + `runHandle()`.
3. `message-bus-broadcast` — broadcast + `reply-to` + `correlationId`.
4. `multi-failure-isolation` — supervisor wrap + `agent.stopped` events.
5. `multi-wallclock-enforcement` — `AbortController` timer wiring.
6. `multi-integration-smoke` — end-to-end fake-clock harness (gate).
7. `agent-lifecycle-reconcile` — close the 3-state vs 5-state gap flagged
   in the risks section.

## Blockers / open questions

- Replace `Scheduler` or co-exist? Lean co-exist one cycle, then
  deprecate once `demo-runner` is ported.
- `priority` explicit integer vs kind-derived? Lean explicit (default 0).
- `agent-lifecycle-design.md` specifies a 5-state machine that
  `BaseAgent` does not implement today. Flagged as follow-on; not in
  scope for this slice.

Contract reference: `ops/contracts/architect.contract.md`.
