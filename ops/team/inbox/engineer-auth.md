# Task 021 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: voice-out-elevenlabs
Branch: codex/voice-out-elevenlabs (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/channels/voice-out.ts
- tests/channels/voice-out.test.ts

## Context

The kiosk speaks responses through a speaker. Implement voice-out as a
channel: subscribe to bus `kind: "completion"` messages, stream the text
to ElevenLabs TTS, pipe audio bytes to `aplay` (or injected spawn).

## Goal

1. `src/channels/voice-out.ts`:
   ```ts
   export interface VoiceOutOptions {
     bus: { subscribe(id: string, h: (msg: unknown) => void): () => void };
     getKey: () => Promise<string> | string;       // ElevenLabs API key
     voiceId?: string;                              // default "21m00Tcm4TlvDq8ikWAM" (Rachel)
     model?: string;                                // default "eleven_flash_v2_5"
     subscribeAs?: string;                          // bus address, default "cli"
     fetchImpl?: typeof fetch;
     spawn?: (cmd: string, args: string[]) => NodeJS.WritableStream;  // injected — default aplay
     now?: () => number;
   }
   export interface VoiceOutChannel {
     start(): Promise<void>;
     stop(): Promise<void>;
   }
   export function createVoiceOutChannel(opts: VoiceOutOptions): VoiceOutChannel;
   ```
   - `start()` subscribes to bus.
   - On `{kind: "completion", payload: {text}}`, POSTs to
     `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream?output_format=pcm_22050` with header `xi-api-key`, body `{text, model_id}`.
   - Streams response body chunks into the `aplay` child process:
     `spawn("aplay", ["-q", "-f", "S16_LE", "-r", "22050", "-c", "1"])`.
   - On `{kind: "error"}`, speak a short "sorry, something went wrong" via the same pipeline.
   - `stop()` unsubscribes, closes aplay stdin.
2. `tests/channels/voice-out.test.ts`:
   - Inject fake bus + `fetchImpl` (returns ReadableStream of fake PCM bytes) + `spawn` (returns PassThrough).
   - Start channel, emit a completion message, assert:
     - fetch called with correct URL + xi-api-key header + body
     - spawn called with aplay args
     - PCM bytes flow into the PassThrough
   - On `kind: "error"`: asserts the apology TTS call was made.
   - `stop()` unsubscribes + closes aplay stream.

## Constraints

- Node built-ins only. `fetch` is global. No `child_process` hard-coded — must be injectable for tests.
- Do NOT touch `src/channels/cli-stdio.ts`, `http.ts`, `file-watch.ts`.
- Do NOT touch `src/auth/**` — take `getKey` as callback.
- Strict TS, no `any`. No mutation of global `process.env`.

## Acceptance criterion

- 2 files, `pnpm check` + `pnpm test tests/channels/voice-out.test.ts` pass.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

Deadline: before next cron tick.
