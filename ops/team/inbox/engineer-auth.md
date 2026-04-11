# Task 011 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: intent-router-impl
Branch: codex/intent-router-impl (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/intents/router.ts
- src/intents/types.ts
- src/intents/index.ts
- tests/intents/router.test.ts

## Context

Cycle-10 PR #33 designed the intent router. Implement it.

## Goal

1. `src/intents/types.ts`:
   ```ts
   export interface IntentHandler {
     agentId: string;
     matches(msg: unknown): boolean;
     priority?: number;   // higher wins
   }
   export interface IntentRouter {
     register(handler: IntentHandler): void;
     dispatch(msg: unknown): string | undefined;  // agentId or undefined
     list(): IntentHandler[];
   }
   ```
2. `src/intents/router.ts` — `createIntentRouter(): IntentRouter`:
   - Stores handlers in priority order (ties: registration order).
   - `dispatch(msg)` iterates handlers, returns first `matches` true.
   - `list()` returns a copy.
3. `src/intents/index.ts` — re-exports.
4. `tests/intents/router.test.ts`:
   - Register 2 handlers with different matchers, dispatch to each.
   - Priority wins: register low-pri first, high-pri second, dispatch picks high-pri.
   - Registration-order tiebreak: equal priority → first registered wins.
   - No match → `dispatch` returns `undefined`.
   - `list()` returns a copy (mutations don't leak).

## Constraints

- No deps. Node built-ins only.
- Do NOT touch other subsystems.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
