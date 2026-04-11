# Task 016 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: channel-file-watch
Branch: codex/channel-file-watch (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- src/channels/file-watch.ts
- tests/channels/file-watch.test.ts

## Goal

Third concrete channel: file-watch. Reads prompts from a file,
delivers each new line as a prompt to an agent, writes replies to a
sibling output file.

1. `src/channels/file-watch.ts` — `FileWatchChannel` implementing the
   `Channel` interface:
   - Constructor: `{ agentId, bus, inPath, outPath, now? }`.
   - `start()`:
     - Opens `inPath` for reading with `fs.promises.open`, seeks to end.
     - Polls the file every 500ms via `fs.stat` to detect new bytes
       (no fs.watch — too platform-dependent). Reads any new content
       via byte offset tracking.
     - For each newline-terminated line, sends a prompt message to
       the bus.
     - Subscribes to `"cli"` (or a configurable replyTo id) for
       completion replies and appends them to `outPath`.
   - `stop()`: clears the interval, closes files, unsubscribes.
2. `tests/channels/file-watch.test.ts`:
   - Uses `os.tmpdir()` + `fs.promises.mkdtemp` for isolation.
   - Creates in/out files, starts channel, appends a line to in,
     waits ~700ms, asserts bus received a prompt message.
   - Fakes a completion reply on the bus, asserts out file has the text.
   - Stops the channel, asserts polling stopped (no more bus messages
     after another file write).

## Constraints

- Pure poll-based; no `fs.watch`.
- Node built-ins only.
- Do NOT touch other channels or agents.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
