# Task 005 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: scheduler-skeleton
Branch: codex/scheduler-skeleton (worktree /home/jason/code/argent-lite-router — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/scheduler/scheduler.ts
- src/scheduler/task-queue.ts
- src/scheduler/types.ts
- src/scheduler/index.ts
- tests/scheduler/scheduler.test.ts
- tests/scheduler/task-queue.test.ts

## Context

Phase 2 is landing the agent topology. Your slice is the **scheduler
side** of the agent contract. Engineer-auth is implementing the agent
skeleton (`src/agents/**`) in parallel — you do NOT import from
`src/agents/` directly; you import the types only. Architect's
`ops/projects/agent-lifecycle-design.md` is the interface reference
(landing this same cycle).

## Goal

1. **`src/scheduler/types.ts`** — exports:
   ```ts
   export interface SchedulableAgent {
     readonly id: string;
     start(): Promise<void>;
     stop(): Promise<void>;
     state: "init" | "ready" | "running" | "suspended" | "stopped";
   }
   export interface ScheduledTask {
     id: string;
     agentId: string;
     runAt: number;
     payload: unknown;
   }
   export interface SchedulerOptions {
     maxConcurrent?: number;  // default 4
     now?: () => number;
   }
   ```
2. **`src/scheduler/task-queue.ts`** — `TaskQueue` class. FIFO with
   priority-by-runAt ordering. Methods: `enqueue(task)`, `dequeueDue(now)`,
   `size()`, `peek()`. Pure data structure, no side effects.
3. **`src/scheduler/scheduler.ts`** — `Scheduler` class:
   - Registers `SchedulableAgent`s via `register(agent)`.
   - `enqueue(task)` adds a scheduled task.
   - `tick()` method pulls due tasks and dispatches to the target agent
     (calls `agent.start()` if not running). Deterministic for testing.
   - `maxConcurrent` limits in-flight task count; excess tasks remain
     queued.
   - Graceful shutdown via `stop()` that awaits in-flight tasks.
4. **`src/scheduler/index.ts`** — re-exports.
5. **Tests:**
   - `task-queue.test.ts` — enqueue out-of-order, dequeue in runAt order,
     peek, size, empty behavior.
   - `scheduler.test.ts` — register 2 mock `SchedulableAgent`s, enqueue
     3 tasks, `tick()` dispatches them in order, respects `maxConcurrent`,
     `stop()` awaits in-flight.

## Constraints

- Do NOT import from `src/agents/**` — take the types inline in
  `src/scheduler/types.ts` (duplication is fine for Phase 2; architect
  will unify later).
- Do NOT import from `src/router/**`, `src/auth/**`, `src/satellite/**`.
- Do NOT touch `package.json`.
- Node built-ins only.
- Strict TS, ESM `.js` specifiers, no `any`.

## Acceptance criterion

- 4 src files + 2 test files exist.
- `pnpm check` and `pnpm test tests/scheduler/` pass.
- SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/scheduler-skeleton`.

## Validation

- `pnpm check`
- `pnpm test tests/scheduler/`
- `wc -l src/scheduler/*.ts tests/scheduler/*.ts`

## Deadline

Before the next cron tick.
