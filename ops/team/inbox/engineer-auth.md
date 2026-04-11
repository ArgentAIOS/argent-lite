# Task 005 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: agent-skeleton
Branch: codex/agent-skeleton (worktree /home/jason/code/argent-lite-auth — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/agents/base-agent.ts
- src/agents/agent-context.ts
- src/agents/message-bus.ts
- src/agents/types.ts
- src/agents/index.ts
- tests/agents/base-agent.test.ts
- tests/agents/message-bus.test.ts

## Context

Phase 2 agent topology is designed in
`ops/projects/agent-topology-lite.md`. Architect is finalizing the
lifecycle contract in `ops/projects/agent-lifecycle-design.md` this
cycle. Your job: implement the agent-side skeleton so the scheduler
(engineer-router's cycle-5 slice) has something to schedule.

## Goal

1. **`src/agents/types.ts`** — exports:
   ```ts
   export type AgentState = "init" | "ready" | "running" | "suspended" | "stopped";
   export interface AgentMessage {
     id: string;
     from: string;
     to: string;
     kind: string;
     payload: unknown;
     ts: number;
   }
   export interface AgentDescriptor {
     id: string;
     state: AgentState;
     startedAt?: number;
   }
   ```
2. **`src/agents/message-bus.ts`** — `MessageBus` class. In-process
   `EventEmitter`-backed pub/sub. Methods:
   `send(msg): void`, `subscribe(agentId, handler): () => void` (returns
   unsubscribe). Best-effort, in-order per (from, to) pair.
3. **`src/agents/agent-context.ts`** — `AgentContext` interface +
   `createAgentContext(opts)` factory. Includes `logger`, `bus`,
   `now: () => number`, `abort: AbortSignal`. No router/auth coupling
   yet — keep it clean.
4. **`src/agents/base-agent.ts`** — abstract class `BaseAgent`:
   - Constructor: `(id: string, ctx: AgentContext)`.
   - Abstract method: `run(): Promise<void>`.
   - Lifecycle: `state: AgentState`, transitions via
     `start()`, `suspend()`, `stop()`. Guard illegal transitions.
   - `onMessage(msg: AgentMessage): void | Promise<void>` default no-op.
5. **`src/agents/index.ts`** — re-exports the public surface.
6. **Tests (vitest):**
   - `base-agent.test.ts` — make a concrete `EchoAgent` subclass that
     echoes every received message back. Test start/stop transitions,
     illegal transition throws, `run()` resolves, `abort` propagates.
   - `message-bus.test.ts` — two agents, send msg from A to B, assert
     receipt, assert in-order delivery, assert unsubscribe.

## Constraints

- Do NOT import `src/router/**`, `src/scheduler/**`, or `src/satellite/**`.
- Do NOT touch `package.json`.
- Node built-ins only (`node:events` for EventEmitter).
- Strict TS, ESM `.js` specifiers, no `any`.

## Acceptance criterion

- 5 src files + 2 test files exist.
- `pnpm test tests/agents/` passes in your worktree (package.json
  is on the integration branch you're based on — verify with
  `ls package.json`).
- `pnpm check` passes.
- SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/agent-skeleton`.

## Validation

- `pnpm check` — exit 0
- `pnpm test tests/agents/` — all passing
- `wc -l src/agents/*.ts tests/agents/*.ts`

## Deadline

Before the next cron tick.
