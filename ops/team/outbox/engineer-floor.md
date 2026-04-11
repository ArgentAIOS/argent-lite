I have read ops/ and am operating under contract:
ops/contracts/engineer-floor.contract.md.

## Summary

Implemented task 016 (slice channel-file-watch): added `FileWatchChannel`,
a poll-based (no fs.watch) channel that tails an input file, emits each
new newline-terminated line as a `prompt` `AgentMessage` on the bus, and
appends completion/error replies (addressed to the configured replyTo,
default `"cli"`) to a sibling output file.

- Seeks to EOF on `start()` so pre-existing content is ignored.
- Polls every `pollMs` (default 500ms) via `FileHandle.stat`, reads the
  delta via byte-offset `FileHandle.read`, buffers partial trailing lines
  in `residual` until a newline arrives.
- `stop()` clears the interval, unsubscribes, closes both handles.
- Node built-ins only, strict TS, no `any`.

## Files touched

- src/channels/file-watch.ts (new)
- tests/channels/file-watch.test.ts (new, 5 tests)
- ops/team/outbox/engineer-floor.md (this file)

No other files changed. `src/channels/index.ts` was intentionally NOT
modified — it is outside the authorized surface. Consumers import the
class directly from `./file-watch.js`.

## Commits

See git log on codex/channel-file-watch (commit recorded after this
file is written; SHA in PR body).

## Validation

- `pnpm check` → exit 0
- `pnpm test tests/channels/file-watch.test.ts` → 5/5 pass (exit 0)
- `pnpm test` (full suite) → 244/244 pass across 41 files (exit 0)
- `pnpm build` → exit 0

## Blockers / follow-ups

- None. If downstream wiring wants `FileWatchChannel` re-exported from
  `src/channels/index.ts`, that is a follow-up slice (outside this
  surface).
