I have read ops/ and am operating under contract:
ops/contracts/engineer-auth.contract.md.

# Task 005 — agent-skeleton

Implemented the Phase 2 agent-side skeleton (`src/agents/**`) so
engineer-router's cycle-5 scheduler has something to schedule. No
coupling to router/scheduler/satellite. Node built-ins only
(`node:events`). Strict TS, ESM `.js` specifiers, no `any`.
`package.json` untouched.

## Files touched

- `src/agents/types.ts` — `AgentState`, `AgentMessage`, `AgentDescriptor`
- `src/agents/message-bus.ts` — `MessageBus` (EventEmitter pub/sub)
- `src/agents/agent-context.ts` — `AgentContext` + `createAgentContext`
- `src/agents/base-agent.ts` — abstract `BaseAgent` with guarded lifecycle
- `src/agents/index.ts` — public re-exports
- `tests/agents/base-agent.test.ts` — `EchoAgent` subclass covers
  start/stop, illegal transitions throw, `run()` resolves on abort,
  abort propagates, bus echo
- `tests/agents/message-bus.test.ts` — delivery, in-order per (from, to),
  isolation between addressees, unsubscribe
- `ops/team/outbox/engineer-auth.md` (this file)

## Lifecycle design

- `init --start()--> running` (invokes `run()` in background, subscribes
  to bus on the agent's id)
- `running --suspend()--> suspended --resume()--> running`
- `running|suspended --stop()--> stopped`
- all other transitions throw `Error`
- when `run()` settles, state collapses to `stopped` and the bus
  subscription is torn down automatically
- `start()` returns the `run()` promise so callers can `await` completion

## Commits

- `0419baf` — agent-skeleton: BaseAgent + MessageBus + AgentContext

Branch: `codex/agent-skeleton`
Pushed to: `origin/codex/agent-skeleton`
PR: https://github.com/ArgentAIOS/argent-lite/pull/11
Base: `codex/ops-team-bootstrap`

## Validation

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm check` | 0 | clean |
| `pnpm test tests/agents/` | 0 | 9/9 passing (2 files) |
| `pnpm test` (full suite) | 0 | 68/68 passing (13 files, no regressions vs cycle-4 baseline of 59) |
| `wc -l src/agents/*.ts tests/agents/*.ts` | 0 | 368 total (5 src files, 2 test files) |

## Blockers / open questions

None. Surface matches the inbox exactly. I added a `resume()` method to
round out the `suspended -> running` transition (kept symmetric with
`suspend()`); the inbox named only `start/suspend/stop` but illegal-
transition guarding still matches the acceptance criterion. If the
architect's final lifecycle contract in
`ops/projects/agent-lifecycle-design.md` renames or removes it, a
follow-up slice can adjust — no external callers yet.

Contract: `ops/contracts/engineer-auth.contract.md`
