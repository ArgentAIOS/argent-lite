# Task 010 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: channel-http
Branch: codex/channel-http (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- src/channels/http.ts
- tests/channels/http.test.ts

## Goal

Second concrete channel: HTTP POST endpoint. Accepts prompts, delivers
to an agent over the bus, returns the completion.

1. `src/channels/http.ts` — `HttpChannel` implementing the `Channel`
   interface from `src/channels/types.ts`:
   - Constructor: `{ agentId, bus, port?: number, host?: string }`.
   - `start()` — creates `http.Server` on `port` (default 0 = random),
     handles `POST /v1/prompt` with JSON body `{prompt: string}`.
   - Delivers prompt to bus, awaits reply with same `trace_id`, writes
     JSON response.
   - 10-second timeout via `AbortController`; returns 504 on timeout.
   - `stop()` closes the server.
   - `port` getter after `start()` so tests can grab the chosen port.
2. `tests/channels/http.test.ts`:
   - Start the channel on port 0, get actual port, POST to `/v1/prompt`
     via Node `fetch`, fake a bus reply, assert JSON response.
   - Test 404 on unknown path.
   - Test 400 on bad body.
   - Test 504 on no reply within timeout (use short timeout + stub bus
     that never replies).

## Constraints

- Node built-ins only (`node:http`).
- Do NOT touch other subsystems.
- Strict TS, no `any`.

## Acceptance criterion

- 2 files, pnpm check + pnpm test tests/channels/http.test.ts pass.
- SELF-COMMIT, PUSH, PR.

## Deadline: before next cron tick.
