# Task 012 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: phase3-e2e-test
Branch: codex/phase3-e2e-test (worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- tests/integration/cli-chat.test.ts
- tests/integration/stub-provider.ts
- tests/integration/README.md

## Context

`ops/projects/phase3-acceptance.md` §4 requires an integration-only
test that drives the chat path with a stub provider, no real network,
and asserts the correct event-kind writes + clean SIGINT teardown.

## Goal

Write the Phase 3 e2e test harness that other cycle-12 slices
(`agent-context-memory` on codex/agent-context-memory and
`phase3-runtime-slice` on codex/phase3-runtime-slice) will slot into.

1. **`tests/integration/stub-provider.ts`** — a `Provider`
   implementation with `id: "stub"`, `kind: "local"`:
   - `complete(req)` → returns `{ text: "stub reply: " + req.prompt, model: "stub-1", providerId: "stub" }`.
   - `healthCheck()` → returns `true`.
2. **`tests/integration/cli-chat.test.ts`** — vitest, included under
   the `vitest.integration.config.ts` that engineer-floor's cycle-4
   slice already created. Skeleton:
   - imports `bootRuntime` from `../../src/integration/runtime.js`
     **dynamically** with a try/catch so this test SKIPS if the
     runtime seam isn't merged yet.
   - uses `stream.PassThrough` for stdin and stdout.
   - boots runtime with `{ providers: [new StubProvider()], memoryPath: tmpdir, now }`.
   - writes `"hello"` to stdin, waits for a line on stdout, asserts it starts with `"stub reply:"`.
   - calls `runtime.shutdown()` and asserts the promise resolves within 500ms.
   - asserts `memory.query("channel")` returns at least one `channel.in`
     and one `router.out` event using only the locked vocabulary.
   - asserts `process._getActiveHandles?.().length` is 0 (or unchanged
     from baseline) after shutdown.
3. **`tests/integration/README.md`** — one paragraph on how to run the
   harness (`pnpm test:integration`).

## Constraints

- Do NOT touch `src/**`. Test-only surface.
- Dynamic imports with try/catch so tests pass (as SKIPPED) even
  before `bootRuntime` lands.
- Strict TS, no `any`.

## Acceptance criterion

- 3 files exist.
- `pnpm test tests/integration/cli-chat.test.ts` either passes (if
  bootRuntime has landed on the branch) or skips cleanly with a clear
  message. Must not FAIL.
- SELF-COMMIT, PUSH, PR.

## Deadline

Before next cron tick.
