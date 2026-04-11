# Task 006 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: agent-helloagent
Branch: codex/agent-helloagent (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/agents/hello-agent.ts
- tests/agents/hello-agent.test.ts

## Context

Phase 2 shipped `BaseAgent`, `MessageBus`, `AgentContext`,
`Scheduler`, `TaskQueue` as isolated units. Cycle-6 proves end-to-end
wiring with a `HelloAgent` that greets a user prompt and returns via
the message bus. No router call yet (that's cycle-7) — we just want
the topology proven.

## Goal

1. **`src/agents/hello-agent.ts`** — `class HelloAgent extends BaseAgent`:
   - Constructor: `(id, ctx)` — forward to super.
   - Override `run()`: subscribe to the bus for incoming messages on
     `to === this.id`, reply with `{ kind: "greeting", payload: "hello, " + msg.payload.name }`.
     When `stop()` is called, unsubscribe.
   - `greet(name: string): string` — pure helper, easy to test.
2. **`tests/agents/hello-agent.test.ts`** — vitest:
   - Instantiate `MessageBus`, `AgentContext`, `HelloAgent`.
   - Start agent, send `{to:"hello", from:"test", kind:"greet", payload:{name:"Jason"}}`.
   - Assert reply arrives with the expected text.
   - Stop agent, assert unsubscribed.
   - Test `greet("Jason")` directly returns `"hello, Jason"`.

## Constraints

- Only touch the 2 files above.
- Import from `src/agents/base-agent.js`, `src/agents/types.js`,
  `src/agents/message-bus.js`. Nothing else.
- Strict TS, no `any`.

## Acceptance criterion

- Both files exist.
- `pnpm test tests/agents/hello-agent.test.ts` passes.
- SELF-COMMIT, PUSH, PR to `codex/ops-team-bootstrap`.

## Deadline

Before next cron tick.
