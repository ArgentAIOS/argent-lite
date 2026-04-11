# Task 015 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: hailo-provider-real
Branch: codex/hailo-provider-real (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/providers/hailo-live.ts
- tests/providers/hailo-live.test.ts

## Context

Cycle-4 shipped `src/providers/hailo.ts` (PR #5) as a pure stub that
always throws. Cycle-7 shipped `src/providers/hailo-runtime.ts`
(PR #19) with `probeHailo()` that calls `hailortcli fw-control identify`
via child_process. Hardware arrives 2026-04-12 (tomorrow). Your job:
write a `HailoLiveProvider` that:

- Probes for hardware at construction time.
- If hardware is absent, every `complete()` throws `HailoUnavailableError`
  (exact same error as the stub) — so the router retry path falls
  through cleanly.
- If hardware is present, `complete()` spawns `hailortcli run ...`
  (exact command TBD — use a placeholder subprocess call with the
  model path from options and stdin prompt, read stdout). If the
  command fails, throw `HailoUnavailableError` with the stderr.
- `healthCheck()` re-runs `probeHailo()` and returns the `present` flag.

The hardware integration is best-effort — tomorrow's characterization
will refine the exact CLI invocation. For today, make the shape
correct and the tests pass with mocks.

## Goal

1. **`src/providers/hailo-live.ts`** — `HailoLiveProvider` class
   implementing the `Provider` interface:
   - Constructor: `{ modelPath: string; probe?: () => Promise<{present: boolean}>; runCli?: (args: string[], input: string) => Promise<{stdout: string; stderr: string; exitCode: number}> }`.
     Both `probe` and `runCli` are injected for testing; default to the
     real implementations via dynamic imports of `./hailo-runtime.js`
     and `node:child_process`.
   - `id = "hailo-live"`, `kind = "local"`.
   - `complete(req)`: probe; if absent, throw. Else run cli with
     `["run", modelPath, "--input", req.prompt]` (placeholder);
     parse stdout as the completion text.
   - `healthCheck()`: returns probe's present flag.
2. **`tests/providers/hailo-live.test.ts`** — mock both `probe` and
   `runCli`:
   - probe returns `{present: false}` → `complete()` throws `HailoUnavailableError`.
   - probe returns `{present: true}`, runCli succeeds → `complete()` returns expected text.
   - probe returns `{present: true}`, runCli exits non-zero → throws with stderr.
   - `healthCheck()` reflects probe result.

## Constraints

- Do NOT touch `src/providers/hailo.ts` or `hailo-runtime.ts` or
  `hailo-capabilities.ts`. New file only.
- No new deps.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
