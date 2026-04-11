# Task 008 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: channel-cli-stdio
Branch: codex/channel-cli-stdio (worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- src/channels/cli-stdio.ts
- src/channels/types.ts
- src/channels/index.ts
- tests/channels/cli-stdio.test.ts

## Context

Phase 3 design at `ops/projects/channels-lite-design.md`. First
concrete channel: CLI stdin/stdout. Reads lines from stdin, posts
them as `AgentMessage`s to the bus, streams replies back to stdout.

## Goal

1. **`src/channels/types.ts`** — interfaces:
   ```ts
   export interface Channel {
     readonly id: string;
     start(): Promise<void>;
     stop(): Promise<void>;
   }
   export interface ChannelOptions {
     agentId: string;  // which agent to deliver input to
     bus: { send(msg: AgentMessage): void; subscribe(id: string, h: (msg: AgentMessage) => void): () => void };
   }
   ```
2. **`src/channels/cli-stdio.ts`** — `CliStdioChannel` class. In `start()`:
   - Creates a readline interface on `process.stdin` (or injected `stdin`).
   - For each line, creates an `AgentMessage` `{id, from: "cli", to: agentId, kind: "prompt", payload: {prompt: line}, ts}` and sends to the bus.
   - Subscribes to replies addressed to `"cli"` and writes them to `process.stdout` (or injected `stdout`). Filters `kind === "completion"` → writes `payload.text`; `kind === "error"` → writes `[error] payload.message`.
   - `stop()` closes the readline + unsubscribes.
3. **`src/channels/index.ts`** — re-exports.
4. **`tests/channels/cli-stdio.test.ts`** — uses `stream.PassThrough`
   for injected stdin/stdout. Writes a line to stdin, asserts the bus
   received a message with the right shape. Fakes a completion reply on
   the bus, asserts the text is written to stdout.

## Constraints

- Inject stdin/stdout so tests can use PassThrough.
- Do NOT touch `src/agents/**`, `src/router/**`, etc.
- Node built-ins only (`node:readline`, `node:stream`).
- Strict TS, ESM, no `any`.

## Acceptance criterion

- 4 files exist.
- `pnpm check` + `pnpm test tests/channels/` pass.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
