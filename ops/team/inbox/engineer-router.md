# Task 016 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: scheduler-concurrent
Branch: codex/scheduler-concurrent (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/scheduler/concurrent.ts
- tests/scheduler/concurrent.test.ts

## Goal

A scheduler upgrade: run N agents concurrently with a hard ceiling.

1. `src/scheduler/concurrent.ts`:
   ```ts
   export interface ConcurrentSchedulerOptions {
     maxConcurrent?: number;  // default 4
     now?: () => number;
   }
   export class ConcurrentScheduler {
     constructor(opts?: ConcurrentSchedulerOptions);
     register(agent: SchedulableAgent): void;
     enqueue(task: ScheduledTask): void;
     tick(): Promise<void>;
     stop(): Promise<void>;
     active(): number;  // count of currently-running agents
   }
   ```
   - Tracks in-flight tasks in a Map keyed by agent id.
   - `tick()` pulls due tasks from an internal queue, dispatches to
     agent, honors `maxConcurrent`.
   - `stop()` waits for all in-flight to complete.
   - `active()` returns the count at call time.
2. `tests/scheduler/concurrent.test.ts`:
   - Register 3 mock agents; enqueue 5 tasks with `maxConcurrent: 2`.
   - Assert only 2 run concurrently; the 3rd starts after one finishes.
   - `stop()` resolves only after in-flight finish.
   - Agent crash does not block the scheduler.

## Constraints

- Do NOT touch `src/scheduler/scheduler.ts` — this is a **new** class.
- Node built-ins only.
- Use a fake clock for determinism (inject `now` + delay via mocks).
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
