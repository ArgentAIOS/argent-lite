# Task 007 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: router-agent
Branch: codex/router-agent (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/agents/router-agent.ts
- tests/agents/router-agent.test.ts

## Context

HelloAgent (cycle-6) proved the topology. Now prove the **router path**:
a `RouterAgent` that receives a prompt over the MessageBus, calls the
router (via `withRouter`), and replies with the completion.

## Goal

1. **`src/agents/router-agent.ts`** — `class RouterAgent extends BaseAgent`:
   - Constructor: `(id, ctx)`. Requires `ctx.router` to be present
     (AgentContextWithRouter from cycle-6 context-router-bridge).
     Throws `RouterAgentError("AgentContext missing router")` otherwise.
   - `override onMessage(msg)`: if `msg.payload` has shape
     `{ prompt: string }`, calls `ctx.router.route({ prompt })`, sends
     the response back over the bus with `kind: "completion"` and
     `payload: { text, providerId }`. On router error, replies with
     `kind: "error"` and `payload: { message }`.
   - `run()`: same pattern as HelloAgent — resolves on abort.
2. **`tests/agents/router-agent.test.ts`** — mock the router:
   ```ts
   const router = { route: vi.fn(async () => ({ text: "mocked", model: "m", providerId: "mock" })), register: vi.fn() };
   ```
   Wrap a base context with `withRouter(ctx, router)`. Send a prompt
   message to the agent over the bus. Assert the router was called
   with `{ prompt }` and a reply was published with
   `kind: "completion"` and `text: "mocked"`.
   Also test the error path: router.route throws → reply kind is `error`.

## Constraints

- Do NOT touch `src/router/**` or base `src/agents/**` files (use them as imports).
- Strict TS, no `any`.
- Import `withRouter` and `AgentContextWithRouter` from cycle-6's
  `src/agents/context-with-router.js`.

## Acceptance criterion

- 2 files exist.
- `pnpm check` passes.
- `pnpm test tests/agents/router-agent.test.ts` passes.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
