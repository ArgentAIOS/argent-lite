# Task 009 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: obs-logger
Branch: codex/obs-logger (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- src/obs/logger.ts
- src/obs/types.ts
- src/obs/index.ts
- tests/obs/logger.test.ts

## Goal

Phase 3 observability **logger** layer.

1. `src/obs/types.ts` — `Logger` interface:
   ```ts
   export type LogLevel = "debug" | "info" | "warn" | "error";
   export interface LogRecord {
     level: LogLevel;
     msg: string;
     ts: number;
     fields?: Record<string, unknown>;
   }
   export interface Logger {
     child(fields: Record<string, unknown>): Logger;
     log(record: LogRecord): void;
     debug(msg: string, fields?: Record<string, unknown>): void;
     info(msg: string, fields?: Record<string, unknown>): void;
     warn(msg: string, fields?: Record<string, unknown>): void;
     error(msg: string, fields?: Record<string, unknown>): void;
   }
   ```
2. `src/obs/logger.ts` — `createLogger(opts: { level?: LogLevel; out?: NodeJS.WritableStream; now?: () => number }): Logger`.
   - Writes one JSON line per log call to `out` (default `process.stderr`).
   - Level filter: drops records below `level`.
   - `child(fields)` returns a logger that merges `fields` into every record.
   - No colors, no pretty-printing — structured JSON only.
3. `src/obs/index.ts` — re-exports.
4. `tests/obs/logger.test.ts` — uses `stream.PassThrough` for `out`, asserts:
   - JSON shape round-trips
   - level filter drops lower records
   - child merges fields
   - ts injected from `now`
   - error arg with a cause object is serialized safely

## Constraints

- Node built-ins only. No new deps.
- Do NOT touch other subsystems.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
