# Task 021 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: kiosk-ui-v0
Branch: codex/kiosk-ui-v0 (worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- src/kiosk/server.ts
- src/kiosk/handlers.ts
- src/kiosk/index.html
- src/kiosk/index.ts
- src/cli/kiosk.ts
- tests/kiosk/handlers.test.ts
- tests/kiosk/server.test.ts
- deploy/argent-lite-kiosk.desktop

## Goal

A full-screen HTTP kiosk UI on `127.0.0.1:7788` with:
- State machine display (idle/listening/thinking/speaking)
- Giant "Tap to Talk" button (push-to-talk)
- Status text line
- Settings gear (opens onboarding wizard — future slice)
- SSE stream `/events` from `argent-lite` daemon that emits state transitions

No AEVP embed yet (cycle-22). Use a CSS radial-gradient disc that pulses/rotates based on state. Plain HTML+JS, no framework.

### Files

1. `src/kiosk/handlers.ts`:
   ```ts
   export interface KioskHandlers {
     status(): Promise<{state: "idle"|"listening"|"thinking"|"speaking"; statusText: string}>;
     talkStart(): Promise<{ok: boolean}>;      // POST — begins mic capture
     talkEnd(): Promise<{ok: boolean; transcript?: string}>;  // POST — stops, returns transcript
     interrupt(): Promise<{ok: boolean}>;      // POST — cancels current speech
   }
   export interface KioskHandlerOptions {
     // Dependency injection for tests. Real impl wires arecord + Groq STT.
     startCapture?: () => Promise<void>;
     stopCapture?: () => Promise<string | undefined>;
     cancelSpeech?: () => Promise<void>;
     getState?: () => "idle"|"listening"|"thinking"|"speaking";
   }
   export function createKioskHandlers(opts?: KioskHandlerOptions): KioskHandlers;
   ```
2. `src/kiosk/server.ts` — HTTP on `127.0.0.1:7788`:
   - `GET /` → `index.html`
   - `GET /api/status` → current state JSON
   - `GET /events` → Server-Sent Events stream (`text/event-stream`) with state ticks every 500ms
   - `POST /api/talk/start` → start mic capture
   - `POST /api/talk/end` → stop + return transcript
   - `POST /api/interrupt` → cancel current TTS
   - Host-header guard (loopback only) same as UI launcher
3. `src/kiosk/index.html` — full-screen, dark theme:
   - Centered 400px radial-gradient disc (CSS `background: radial-gradient(...)`) that pulses at 1s breath when idle, rotates when listening, accelerates when thinking, pulses fast when speaking.
   - Status text "Tap to talk" / "Listening..." / "Thinking..." / "[response]"
   - 280×100 tap-to-talk button at bottom (pressdown = talk/start, release = talk/end)
   - Settings gear (top-right, 40px) with `onclick` → `alert('settings panel ships cycle-22')` placeholder
   - SSE subscription to `/events` for live state updates
4. `src/cli/kiosk.ts` — `runKiosk(argv)`:
   - Creates real handlers (stubs `startCapture`/`stopCapture` for now — prints `[kiosk] mic capture not wired yet` and returns immediately)
   - Starts `startKioskServer({port: 7788, handlers})`
   - Logs `listening on http://127.0.0.1:7788`
   - SIGINT clean shutdown
5. `tests/kiosk/handlers.test.ts` — inject mocks, verify state transitions + error paths
6. `tests/kiosk/server.test.ts` — PassThrough streams, verify `/api/status`, SSE `/events` connects, host-header rejection (403 on evil.com)
7. `deploy/argent-lite-kiosk.desktop` — freedesktop entry with `Exec=chromium --kiosk --noerrdialogs --disable-infobars http://127.0.0.1:7788`

## Constraints

- Node built-ins only. No frameworks. No new deps.
- Real mic/speaker wiring is **engineer-auth** and **engineer-router** this cycle — you just need the stub to return "not wired" so tests pass.
- Strict TS, no `any`.

## Acceptance criterion

- 7 files exist.
- `pnpm check` + `pnpm test tests/kiosk/` pass.
- `node dist/src/cli/kiosk.js` binds 7788 and serves the HTML.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

Deadline: before next cron tick.
