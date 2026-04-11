# Task 016 — architect

Contract: ops/contracts/architect.contract.md
Slice: multi-agent-design
Branch: codex/multi-agent-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/multi-agent-design.md

## Goal

`ops/projects/multi-agent-design.md` (≤150 lines): the design for
multi-agent fan-out — running N concurrent agents on the Pi.

1. Agent lifecycle extension: concurrent `start()` vs serialized.
2. Resource budget: per-agent maxConcurrentRouterCalls, wall-clock cap.
3. Scheduler upgrades: a `maxConcurrent` ceiling on active agents, task
   priority respect.
4. Cross-agent message delivery (broadcast, targeted, reply-to).
5. Failure isolation: one agent crashing must not break others.
6. Candidate files: `src/scheduler/multi.ts` (new), updates to
   `src/scheduler/scheduler.ts`.
7. Test strategy: deterministic fake-clock tests, no flaky sleeps.
8. Phased sub-slices and dependencies.

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
