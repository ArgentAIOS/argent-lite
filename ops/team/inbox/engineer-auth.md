# Task 018 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: satellite-client-wiring
Branch: codex/satellite-client-wiring (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/satellite/runtime-client.ts
- tests/satellite/runtime-client.test.ts

## Context

Cycle-15 added `createRuntimeSatelliteServer` with HMAC auth. Now the
matching client: a wrapper that signs outgoing requests to a satellite
server and handles retries.

## Goal

1. **`src/satellite/runtime-client.ts`**:
   ```ts
   export interface SatelliteClientOptions {
     baseUrl: string;        // http://mac-host:port
     secret: string;         // shared HMAC secret
     timeoutMs?: number;     // default 10000
     retries?: number;       // default 1
     now?: () => number;
     fetchImpl?: typeof fetch;  // injected for tests
   }
   export interface RuntimeSatelliteClient {
     request(req: SatelliteRequest): Promise<SatelliteResponse>;
     ping(): Promise<boolean>;
   }
   export function createRuntimeSatelliteClient(
     opts: SatelliteClientOptions,
   ): RuntimeSatelliteClient;
   ```
   - `request()`:
     - Serializes via `encodeRequest` (from `protocol.ts`).
     - Computes HMAC via `hmacSign` (from `auth.ts`).
     - Sends `POST ${baseUrl}/v1/satellite/request` with
       `Authorization: Bearer ${secret}` and `x-satellite-sig: ${sig}`.
     - Parses reply via `decodeResponse`.
     - Retries on network error or 5xx, up to `retries` times.
     - Times out via `AbortController` after `timeoutMs`.
   - `ping()` sends a `kind: "ping"` request, returns true on 2xx.
2. **`tests/satellite/runtime-client.test.ts`** — inject `fetchImpl`:
   - Valid request round-trip.
   - Retries on network error.
   - Gives up after `retries` exhausted.
   - Timeout triggers AbortController.
   - Auth headers present.
   - `ping()` returns true on 2xx, false on 5xx.

## Constraints

- Import-only from `src/satellite/{protocol,auth,types}.js`. Do NOT
  touch those files or other satellite files.
- Node built-ins only.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
