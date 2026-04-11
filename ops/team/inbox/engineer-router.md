# Task 013 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: runtime-bus-wiring-fix
Branch: codex/runtime-bus-wiring-fix (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/integration/runtime.ts
- tests/integration/runtime.test.ts

## Context

Threadmaster's Phase 3 §4 smoke found that `bootRuntime()` subscribes
to the bus for channel-in logging but NEVER delivers messages to the
RouterAgent instance. After `"say hi"` is piped in, memory.sqlite has
one `channel.in` row and zero `router.out` rows. The RouterAgent is
constructed but receives nothing.

The RouterAgent's `onMessage(msg)` is the entry point for prompts. It
must be called when a message is sent to the agent. Check
`src/agents/router-agent.ts` and `src/agents/base-agent.ts` — whoever
is supposed to dispatch `onMessage` is either not subscribed or is
subscribed wrong in `bootRuntime`.

Also: replies go back on the bus with `to: msg.from` (which is "cli"
when the CliStdioChannel sent it). Verify the CliStdioChannel is
actually subscribed to `"cli"` for completion replies so they print
to stdout.

## Goal

1. **Fix `src/integration/runtime.ts`** so that:
   - When a message with `kind: "prompt"` arrives on the bus addressed
     to `"router"`, the runtime **delivers it to `agent.onMessage(msg)`**.
     The cleanest fix: after the existing `intentRouter.dispatch(msg)`
     in the `bus.subscribe("router", ...)` callback, directly call
     `agent.onMessage(msg)` on the constructed `RouterAgent` (or use
     a more principled `scheduler.deliver(target, msg)` if you add
     such a method — but keep the diff small).
   - `channel.in` and (when the router completes) `router.out` both
     land in memory. Since `withMemoryLog` writes `router.out` on its
     own after the reconcile slice merges, runtime.ts does NOT need to
     write `router.out` itself.
   - `channel.out` is written when the reply goes back over the bus
     to `"cli"` (the existing bus.subscribe("cli", ...) is already
     correct — verify it's actually firing).
2. **Update `tests/integration/runtime.test.ts`** — add a test that
   injects a stub provider, pipes a prompt through a PassThrough stdin,
   waits up to 500ms, asserts:
   - `memory.query("router")` contains at least one `channel.in` and
     at least one `router.out` (or `channel.out` if `withMemoryLog`'s
     rename lands in the reconcile slice).
   - stdout PassThrough received at least one line containing the stub
     reply.
   - `runtime.shutdown()` resolves within 500ms and
     `process._getActiveHandles?.().length` is stable.

## Coordination

Cycle-13's `event-kind-reconcile` slice (engineer-auth) is renaming
`router.route` → `router.out` in `memory-router.ts`. If your tests
depend on the old name, they'll fail on integration. Use `router.out`
in your assertions.

## Constraints

- Do NOT touch `src/router/**`, `src/agents/**`, `src/channels/**`,
  `src/memory/**`, `src/scheduler/**`. The fix lives in `runtime.ts`
  wiring only.
- Strict TS, no `any`.

## Acceptance criterion

- `pnpm check` + `pnpm test tests/integration/runtime.test.ts` pass.
- Manual-equivalent assertion in the test covers §4 of
  `ops/projects/phase3-acceptance.md`.
- SELF-COMMIT, PUSH, PR.

## Deadline: before next cron tick.
