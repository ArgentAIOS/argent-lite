# Task 015 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: satellite-server-wiring
Branch: codex/satellite-server-wiring (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/satellite/runtime-server.ts
- tests/satellite/runtime-server.test.ts

## Context

Cycle-4 shipped `src/satellite/server.ts` (PR #7) with a basic HTTP
server. Cycle-10 shipped `src/satellite/auth.ts` (PR #31) with HMAC +
bearer token `requireAuth`. Connect them: a new higher-level
`createSatelliteServer` that requires auth on every request and
delegates valid requests to an injected handler.

## Goal

1. **`src/satellite/runtime-server.ts`** — exports:
   ```ts
   export interface SatelliteServerOptions {
     port?: number;          // default 0 = random
     host?: string;          // default "127.0.0.1"
     secret: string;         // required — HMAC + bearer token
     handler: (req: SatelliteRequest) => Promise<SatelliteResponse>;
     now?: () => number;
   }
   export interface RunningSatelliteServer {
     port: number;
     stop(): Promise<void>;
   }
   export async function createRuntimeSatelliteServer(
     opts: SatelliteServerOptions,
   ): Promise<RunningSatelliteServer>;
   ```
   - Uses `node:http.createServer`.
   - On `POST /v1/satellite/request` with JSON body:
     - Calls `requireAuth(req.headers, { secret })` — on error, 401 with JSON `{error: "unauthorized"}`.
     - Parses body with `decodeRequest` from `protocol.ts`.
     - Calls `handler(parsed)`, awaits response.
     - Writes `encodeResponse(response)` as body.
   - On any other method/path, 404.
   - On parse error, 400 with the error.
2. **`tests/satellite/runtime-server.test.ts`** — uses `node:http` +
   global `fetch`:
   - Starts the server with a stub handler that echoes the payload.
   - POSTs a valid request with correct HMAC headers; asserts 200 and
     response round-trips.
   - POSTs without auth; asserts 401.
   - POSTs with wrong secret; asserts 401.
   - POSTs to unknown path; asserts 404.
   - POSTs invalid JSON; asserts 400.
   - Stops the server; asserts port is freed.

## Constraints

- Do NOT touch `src/satellite/server.ts`, `client.ts`, `protocol.ts`,
  `types.ts`, `auth.ts`, `index.ts`. New file only.
- Node built-ins only.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
