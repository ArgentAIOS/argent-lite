# Task 004 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: satellite-protocol-stub
Branch: codex/satellite-protocol-stub (worktree /home/jason/code/argent-lite-auth — reuse)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/satellite/index.ts                    (create)
- src/satellite/client.ts                   (create)
- src/satellite/server.ts                   (create)
- src/satellite/protocol.ts                 (create)
- src/satellite/types.ts                    (create)
- tests/satellite/client.test.ts            (create)
- tests/satellite/protocol.test.ts          (create)

## Context

Phase 1 CLI has a **satellite mode stub** that emits a warning and
falls through to standalone. Your job is to implement the first real
layer: a client↔server protocol between the Pi (Lite) and a Mac
(primary Argent brain). This slice implements **transport + framing**
only. Semantics (intent dispatch, memory sync) come later.

## Goal

Minimal HTTP-based protocol on Node built-ins:

```ts
// types.ts
export interface SatelliteRequest {
  id: string;                // uuid v4
  kind: "completion" | "health" | "ping";
  payload: unknown;
  ts: number;
}

export interface SatelliteResponse {
  id: string;                // echoes request id
  ok: boolean;
  payload?: unknown;
  error?: string;
}
```

1. `src/satellite/types.ts` — types above.
2. `src/satellite/protocol.ts` — pure functions:
   `encodeRequest(req): string`, `decodeRequest(s): SatelliteRequest`,
   same for response. Validates shape before returning. Throws
   `SatelliteProtocolError` on bad input.
3. `src/satellite/client.ts` — `SatelliteClient` class. Constructor:
   `{ macBaseUrl: string, authToken?: string }`. Methods:
   `ping(): Promise<boolean>`, `complete(payload): Promise<unknown>`.
   Uses Node's built-in `fetch` with 5-second timeout via
   `AbortController`. Retries once on network error.
4. `src/satellite/server.ts` — `createSatelliteServer(opts)` returns a
   bare `http.Server` that handles `POST /v1/satellite/request`, parses
   via `protocol.decodeRequest`, returns a canned response for each
   kind. This is the **local stub** — in satellite mode the Pi acts as
   server too, so the Mac can push commands back. Secondary role.
5. `src/satellite/index.ts` — re-exports the public surface.
6. Tests:
   - `protocol.test.ts` — round-trip encode/decode, malformed input
     throws `SatelliteProtocolError`, extra fields preserved.
   - `client.test.ts` — mocks global `fetch`, asserts URL + headers,
     asserts retry on first failure then success, asserts timeout
     triggers via `AbortController`.

## Constraints

- Node built-ins only. No express, no axios, no ws.
- Do NOT touch `src/auth/**` — that's complete. If you need auth
  headers, take them as constructor opts, do not import.
- Do NOT touch `src/router/**`, `src/cli/**`, `src/config/**`.
- Strict TypeScript. ESM. `.js` import specifiers.

## Acceptance criterion

- All 7 files exist.
- No `any`, no `@ts-ignore`, no new dependencies.
- Tests contain real assertions.
- `ops/team/outbox/engineer-auth.md` has confirmation line, files
  touched, line counts, and notes on any blockers.

## Validation commands

- `ls src/satellite/ tests/satellite/`
- `wc -l src/satellite/*.ts tests/satellite/*.ts`

## Deadline

Before the next cron tick.
