# Task 019 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: obs-file-sink
Branch: codex/obs-file-sink (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- src/obs/file-sink.ts
- tests/obs/file-sink.test.ts

## Goal

Add a file sink to the logger — writes JSON lines to a file with
size-based rotation.

1. `src/obs/file-sink.ts`:
   ```ts
   export interface FileSinkOptions {
     path: string;
     maxBytes?: number;        // default 10 MiB
     maxFiles?: number;        // default 5
     now?: () => number;
   }
   export function createFileSink(opts: FileSinkOptions): NodeJS.WritableStream;
   ```
   - Uses `fs.createWriteStream` under the hood.
   - On each write, tracks bytes; when exceeds `maxBytes`, rotates:
     `path` → `path.1`, `path.1` → `path.2`, ..., drop oldest.
   - Exposes a `Writable` so it plugs into `createLogger({out: sink})`.
   - Rotation is async but guarded by a mutex so concurrent writes
     don't race.
2. `tests/obs/file-sink.test.ts`:
   - Writes small records to a temp file, asserts content.
   - Writes enough to trigger rotation, asserts path.1 exists.
   - Rotates multiple times, asserts maxFiles cap.
   - Close propagates.

## Constraints

- Node built-ins only.
- Do NOT touch other obs files.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
