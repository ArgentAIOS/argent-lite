# Task 013 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: event-kind-reconcile
Branch: codex/event-kind-reconcile (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/router/memory-router.ts
- src/runtime/event-kinds.ts
- ops/projects/event-kind-vocabulary.md
- tests/router/memory-router.test.ts
- tests/runtime/event-kinds.test.ts
- src/integration/runtime.ts                 (ONLY to update the fallback allowlist)

## Context

Threadmaster's Phase 3 §4 smoke revealed the vocabulary is split:

- `src/router/memory-router.ts` writes `kind: "router.route"` and
  `kind: "router.error"`.
- `src/runtime/event-kinds.ts` (cycle-12 lock PR #38) defines the set
  as `["channel.in","channel.out","router.in","router.out","agent.error"]`.
- `src/integration/runtime.ts` fallback allowlist uses the OLD kinds
  `router.route`, `router.error` — and that disagrees with the lock.

## Decision

**Canonical kinds: `router.in`, `router.out`, `agent.error`.**

Rationale: cycle-12's lock is the published contract. `router.route`
was a pre-lock draft name. Update `memory-router.ts` and
`integration/runtime.ts` fallback to use `router.out` (success) and
`agent.error` (failure).

## Goal

1. **`src/router/memory-router.ts`** — change its two kind writes:
   - success → `router.out` (payload should include req + providerId + model).
   - failure → `agent.error` (payload includes req + error message).
2. **`tests/router/memory-router.test.ts`** — update assertions to
   expect the new kinds.
3. **`src/integration/runtime.ts`** — update the fallback allowlist
   constant to match `src/runtime/event-kinds.ts` (so the fallback
   and the real lock agree).
4. **`src/runtime/event-kinds.ts`** — add a top-of-file comment
   documenting that these are the ONLY 5 kinds the runtime writes,
   and that any future kind requires a design change.
5. **`ops/projects/event-kind-vocabulary.md`** — append a §"2026-04-11
   reconciliation" note describing the mismatch and the fix.
6. **`tests/runtime/event-kinds.test.ts`** — add a regression test
   that the old kinds `router.route` and `router.error` are **not**
   accepted by `isEventKind`.

## Constraints

- Do NOT touch other subsystems.
- Strict TS, no `any`.

## Acceptance criterion

- `pnpm check` + `pnpm test tests/router/memory-router tests/runtime/event-kinds` pass.
- SELF-COMMIT, PUSH, PR.

## Deadline: before next cron tick.
