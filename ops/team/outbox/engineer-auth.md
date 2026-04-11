I have read ops/ and am operating under contract:
ops/contracts/engineer-auth.contract.md.

## Summary

Slice: **satellite-protocol-stub** (branch `codex/satellite-protocol-stub`,
worktree `/home/jason/code/argent-lite-auth`).

Implemented the HTTP transport + framing layer for the Pi↔Mac satellite
protocol on Node built-ins only. No new dependencies, no `any`, no
`@ts-ignore`. Semantics (intent dispatch, memory sync) are intentionally
deferred — this slice is transport only, per inbox.

## Files touched (7 created)

- `src/satellite/types.ts` (22 lines) — `SatelliteRequest`,
  `SatelliteResponse`, `SatelliteProtocolError`.
- `src/satellite/protocol.ts` (90 lines) — `encodeRequest`,
  `decodeRequest`, `encodeResponse`, `decodeResponse`; strict shape
  validation, throws `SatelliteProtocolError` on bad input; extra fields
  are preserved on decode.
- `src/satellite/client.ts` (101 lines) — `SatelliteClient` class.
  Constructor takes `{ macBaseUrl, authToken?, timeoutMs?, fetchImpl? }`.
  Uses Node built-in `fetch`. 5s default timeout via `AbortController`.
  Retries once on non-protocol error. Bearer auth header when token
  provided. `ping()` and `complete(payload)`.
- `src/satellite/server.ts` (108 lines) — `createSatelliteServer(opts)`
  returning a bare `http.Server`. Handles `POST /v1/satellite/request`,
  verifies optional Bearer token, decodes via `protocol.decodeRequest`,
  returns canned responses per kind (ping/health/completion).
  MAX_BODY_BYTES cap. Secondary role (Pi-as-server for Mac push).
- `src/satellite/index.ts` (14 lines) — public re-exports.
- `tests/satellite/protocol.test.ts` (85 lines, 8 tests) — round-trip
  encode/decode for request+response, extra-field preservation, malformed
  JSON, missing fields, bad kind, bad `ok`, invalid encode input.
- `tests/satellite/client.test.ts` (128 lines, 5 tests) — mocks
  `fetchImpl`; asserts URL construction, POST method, `Bearer` auth
  header, `content-type: application/json`, no auth header when token
  absent, retry-once-then-succeed, fail-after-one-retry,
  `AbortController` abort fires on timeout.

Total: 548 lines across 7 authorized files.

## Commits

- See `git log codex/satellite-protocol-stub` — one commit,
  `satellite-protocol-stub: transport + framing`. SHA printed at
  push time.

## Validation (real exit codes)

- `pnpm install` — exit 0 (fresh `node_modules` in this worktree).
- `pnpm check` — exit 0 (strict tsc, no errors).
- `pnpm test` — exit 0, **51/51 tests passing** across 9 files. 13 new
  tests (8 protocol + 5 client). Other slices unaffected.
- `pnpm build` — exit 0 (tsc emit OK).
- `ls src/satellite/ tests/satellite/` — all 7 authorized files present,
  no extras.
- `wc -l src/satellite/*.ts tests/satellite/*.ts` — 548 total lines.

## Surface discipline

No files were touched outside the authorized surface. `src/auth/**`,
`src/router/**`, `src/cli/**`, `src/config/**` untouched.

## Blockers / deferred follow-ups

- None blocking. Notes for the next slice owner:
  - `complete()` currently returns the raw `payload` echoed from the
    server canned stub. Real completion semantics (prompt → provider →
    streamed tokens) are out of scope here.
  - Server responds with a `{ text: "", note: "satellite stub …" }`
    canned payload for `completion`; that becomes real in the next
    intent-dispatch slice.
  - No wiring into the CLI satellite-mode code path yet — that belongs
    to a follow-up slice that will flip the CLI stub warning to a real
    `SatelliteClient` call. Intentionally deferred per inbox scope.
