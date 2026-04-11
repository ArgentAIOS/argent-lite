# Task 012 — architect

Contract: ops/contracts/architect.contract.md
Slice: event-kind-lock
Branch: codex/event-kind-lock (worktree /home/jason/code/argent-lite-cli)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/event-kind-vocabulary.md
- src/runtime/event-kinds.ts
- tests/runtime/event-kinds.test.ts

## Context

`ops/projects/phase3-acceptance.md` §3.8 requires locking the runtime
event-kind vocabulary to exactly 5 values before Phase 3 closes:
`channel.in`, `channel.out`, `router.in`, `router.out`, `agent.error`.

## Goal

1. **`ops/projects/event-kind-vocabulary.md`** — one page describing
   each kind, its shape, and its producer. Exactly 5 kinds, no more.
2. **`src/runtime/event-kinds.ts`** — exports:
   ```ts
   export const EVENT_KINDS = ["channel.in","channel.out","router.in","router.out","agent.error"] as const;
   export type EventKind = typeof EVENT_KINDS[number];
   export function isEventKind(v: string): v is EventKind {
     return (EVENT_KINDS as readonly string[]).includes(v);
   }
   export function assertEventKind(v: string): asserts v is EventKind {
     if (!isEventKind(v)) throw new Error(`invalid event kind: ${v}`);
   }
   ```
3. **`tests/runtime/event-kinds.test.ts`** — `isEventKind` returns true
   for each of the 5 and false for others; `assertEventKind` throws on
   invalid; constants are frozen (can't be mutated).

SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
