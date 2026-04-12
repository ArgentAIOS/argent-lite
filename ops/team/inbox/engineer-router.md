# Task 021 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: voice-in-groq
Branch: codex/voice-in-groq (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/channels/voice-in.ts
- tests/channels/voice-in.test.ts

## Context

The kiosk listens when push-to-talk is held. Implement voice-in: capture
WAV via `arecord`, POST to Groq's `whisper-large-v3` endpoint, publish
the transcript as a bus prompt message.

## Goal

1. `src/channels/voice-in.ts`:
   ```ts
   export interface VoiceInOptions {
     bus: { send(msg: unknown): void };
     getKey: () => Promise<string> | string;    // Groq API key
     agentId?: string;                           // bus target, default "router"
     model?: string;                             // default "whisper-large-v3"
     language?: string;                          // default "en"
     spawn?: (cmd: string, args: string[]) => {
       stdout: NodeJS.ReadableStream;
       stderr: NodeJS.ReadableStream;
       kill: (sig?: NodeJS.Signals) => void;
       exitCode: number | null;
     };
     fetchImpl?: typeof fetch;
     now?: () => number;
   }
   export interface VoiceInChannel {
     start(): Promise<void>;          // push-to-talk begins; spawns arecord
     stop(): Promise<string>;         // push-to-talk ends; uploads + returns transcript
     abort(): Promise<void>;          // cancel current capture without transcribing
   }
   export function createVoiceInChannel(opts: VoiceInOptions): VoiceInChannel;
   ```
   - `start()` spawns `arecord` (default args: `["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "wav", "-"]`) and buffers stdout into memory.
   - `stop()`:
     - Sends `SIGTERM` to arecord, waits for exit
     - Wraps buffered PCM in a multipart/form-data Blob
     - POSTs to `https://api.groq.com/openai/v1/audio/transcriptions` with fields `file`, `model`, `language`, `response_format: json`
     - Header `Authorization: Bearer <key>`
     - Parses `{text}` from response
     - Calls `bus.send({id: "voice-"+now, kind: "prompt", from: "voice-in", to: agentId, payload: {prompt: text}, ts: now()})`
     - Returns the transcript text
   - `abort()` kills arecord without upload.
   - All file I/O in-memory; no temp files.
2. `tests/channels/voice-in.test.ts`:
   - Inject fake `spawn` that returns a `stream.PassThrough` as stdout and a stub `kill`.
   - Inject `fetchImpl` that asserts on URL + auth header + multipart body + returns `{text: "hello world"}`.
   - Inject fake bus (object with `send: vi.fn()`).
   - Sequence: `start()` → push PCM bytes into stdout → `stop()` → assert bus.send called with the expected prompt message shape and method returns `"hello world"`.
   - `abort()` test: start + abort → assert kill called, fetch NOT called, bus.send NOT called.
   - Error paths: fetch returns 401 → stop throws `VoiceInError`.

## Constraints

- Node built-ins only. Injectable spawn for tests.
- Do NOT touch other channels or auth files.
- Strict TS, no `any`.

## Acceptance criterion

- 2 files, `pnpm check` + `pnpm test tests/channels/voice-in.test.ts` pass.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

Deadline: before next cron tick.
