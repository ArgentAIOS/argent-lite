# Task 006 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: demo-runner
Branch: codex/demo-runner (worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- src/demo/runner.ts
- src/demo/README.md
- tests/demo/runner.test.ts
- package.json                              (add "demo" script only)

## Context

Phase 2 shipped isolated skeletons for agents + scheduler but nothing
wires them to the router yet. Your job: write a demo runner that
boots a `Scheduler`, registers a single `HelloAgent` (from engineer-auth's
cycle-6 slice `codex/agent-helloagent`), enqueues a task, ticks the
scheduler, and prints the output.

## Goal

1. **`src/demo/runner.ts`** — async `runDemo()` that:
   - Constructs a `MessageBus`, `AgentContext`, `Scheduler`.
   - Dynamically imports `HelloAgent` from `../agents/hello-agent.js`
     (guarded by try/catch so your branch builds standalone if
     engineer-auth's branch isn't merged yet).
   - If HelloAgent is available, registers it, enqueues a "greet"
     task, ticks once, awaits result.
   - If not, prints `[demo] HelloAgent not available on this branch`
     and exits 0.
2. **`src/demo/README.md`** — one paragraph.
3. **`tests/demo/runner.test.ts`** — test with a mocked `HelloAgent`
   (injected) that verifies the runner calls `register → enqueue → tick`
   in order and returns the agent's echoed greeting.
4. **`package.json`** — add `"demo": "node --loader tsx/esm src/demo/runner.ts"`
   to `scripts`. DO NOT add dependencies.

## Constraints

- Do NOT touch `src/agents/**` or `src/scheduler/**` — read-only imports.
- Strict TS, ESM `.js` specifiers, no `any`.

## Acceptance criterion

- 3 source + 1 test file created; package.json has the demo script.
- `pnpm check` and `pnpm test tests/demo/` pass.
- SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/demo-runner`.

## Validation

- `pnpm check` — exit 0
- `pnpm test tests/demo/` — pass
- `pnpm demo` — should print something (stub-tolerant)

## Deadline

Before next cron tick.
