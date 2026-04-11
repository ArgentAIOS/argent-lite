# Task 010 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: satellite-auth-hardening
Branch: codex/satellite-auth-hardening (worktree /home/jason/code/argent-lite-auth)
Surface:
- ops/team/outbox/engineer-auth.md
- src/satellite/auth.ts
- tests/satellite/auth.test.ts

## Context

Cycle-4 landed satellite-protocol-stub (PR #7) with optional bearer
auth. Before satellite mode can be exposed off-box, auth MUST be
mandatory.

## Goal

1. `src/satellite/auth.ts`:
   - `hmacSign(body: string, secret: string): string` — HMAC-SHA256 of
     body, returns hex.
   - `verifyHmac(body: string, secret: string, signature: string): boolean`
     — constant-time comparison via `crypto.timingSafeEqual`.
   - `SatelliteAuthError` class.
   - `requireAuth(req, opts: { secret: string }): void` — reads the
     `authorization` header (`Bearer <token>`) and `x-satellite-sig`
     header, verifies token equals `opts.secret` and sig is valid for
     the body. Throws `SatelliteAuthError` on any failure.
2. `tests/satellite/auth.test.ts`:
   - HMAC round-trip with fixed body/secret → stable hex
   - `verifyHmac` returns true on match, false on mismatch
   - `requireAuth` passes on valid headers
   - Missing authorization → throws with clear message
   - Wrong secret → throws
   - Tampered body → throws
   - Timing safety: compare two wrong-sigs of same length doesn't short-circuit

## Constraints

- Node built-ins only (`node:crypto`).
- Do NOT touch `src/satellite/server.ts`, `client.ts`, `protocol.ts`,
  `types.ts`, or `index.ts`. A follow-up slice will wire `requireAuth`
  into the server.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
