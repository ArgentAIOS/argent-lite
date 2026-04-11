# Task 008 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: router-agent-live
Branch: codex/router-agent-live (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/demo/e2e-runner.ts
- tests/demo/e2e-runner.test.ts

## Context

Cycle-7 landed `RouterAgent` (PR #18) with injected mock router. Now
wire it to the **real** default router (from cycle-6 PR #15
`createDefaultRouter`) + a real credential store (`createCredentialStore`
from cycle-3 PR #3), boot a mini end-to-end demo.

## Goal

1. **`src/demo/e2e-runner.ts`** — `runE2E(opts?)` async function:
   - Builds `MessageBus`, `AgentContext`.
   - Creates a `CredentialStore` with env backend via `createCredentialStore({backend: "env"})`.
   - Calls `createDefaultRouter({ credentials })` from `../router/default-router.js`.
   - Wraps the context via `withRouter(ctx, router)`.
   - Instantiates `RouterAgent("router", wrappedCtx)`.
   - Registers with a `Scheduler`, enqueues a task carrying a prompt.
   - Ticks the scheduler; sends a message to the agent over the bus;
     awaits the reply.
   - Returns `{ status: "ok", text }` or `{ status: "error", message }`.
   - Accepts injected `router` override so tests can bypass network.
2. **`tests/demo/e2e-runner.test.ts`** — injects a mock router that
   returns `{ text: "mocked", model: "m", providerId: "mock" }`.
   Asserts the runner boots, enqueues, routes, and returns `{ status: "ok", text: "mocked" }`.

## Constraints

- Do NOT touch `src/agents/**`, `src/router/**`, `src/scheduler/**`.
- Inject credentials + router override for tests.
- Strict TS, no `any`.

## Acceptance criterion

- 2 files.
- `pnpm check` + `pnpm test tests/demo/e2e-runner.test.ts` pass.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
