import { spawn as nodeSpawn } from "node:child_process";

export interface VoiceOutOptions {
  bus: { subscribe(id: string, h: (msg: unknown) => void): () => void };
  getKey: () => Promise<string> | string;
  voiceId?: string;
  model?: string;
  subscribeAs?: string;
  fetchImpl?: typeof fetch;
  spawn?: (cmd: string, args: string[]) => NodeJS.WritableStream;
  now?: () => number;
}

export interface VoiceOutChannel {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_flash_v2_5";
const DEFAULT_SUBSCRIBE_AS = "cli";
const APLAY_CMD = "aplay";
const APLAY_ARGS: readonly string[] = ["-q", "-f", "S16_LE", "-r", "22050", "-c", "1"];
const APOLOGY_TEXT = "Sorry, something went wrong.";

interface CompletionMessage {
  kind: "completion";
  payload: { text: string };
}

function isCompletionMessage(msg: unknown): msg is CompletionMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as { kind?: unknown; payload?: unknown };
  if (m.kind !== "completion") return false;
  if (typeof m.payload !== "object" || m.payload === null) return false;
  return typeof (m.payload as { text?: unknown }).text === "string";
}

function isErrorMessage(msg: unknown): boolean {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { kind?: unknown }).kind === "error"
  );
}

function defaultSpawn(cmd: string, args: string[]): NodeJS.WritableStream {
  const child = nodeSpawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
  if (child.stdin === null) {
    throw new Error(`voice-out: spawn(${cmd}) did not expose stdin`);
  }
  return child.stdin;
}

export function createVoiceOutChannel(opts: VoiceOutOptions): VoiceOutChannel {
  const voiceId = opts.voiceId ?? DEFAULT_VOICE_ID;
  const model = opts.model ?? DEFAULT_MODEL;
  const subscribeAs = opts.subscribeAs ?? DEFAULT_SUBSCRIBE_AS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const spawnFn = opts.spawn ?? defaultSpawn;

  let unsubscribe: (() => void) | null = null;
  let aplayStdin: NodeJS.WritableStream | null = null;
  let stopped = false;

  function ensureAplay(): NodeJS.WritableStream {
    if (aplayStdin === null) {
      aplayStdin = spawnFn(APLAY_CMD, [...APLAY_ARGS]);
    }
    return aplayStdin;
  }

  async function speak(text: string): Promise<void> {
    if (stopped) return;
    const key = await opts.getKey();
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_22050`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/pcm",
      },
      body: JSON.stringify({ text, model_id: model }),
    });
    if (!res.ok || res.body === null) return;
    const sink = ensureAplay();
    const reader = res.body.getReader();
    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          sink.write(Buffer.from(value));
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  function handle(msg: unknown): void {
    if (isCompletionMessage(msg)) {
      void speak(msg.payload.text).catch(() => {});
      return;
    }
    if (isErrorMessage(msg)) {
      void speak(APOLOGY_TEXT).catch(() => {});
    }
  }

  return {
    async start(): Promise<void> {
      if (unsubscribe !== null) {
        throw new Error("VoiceOutChannel already started");
      }
      stopped = false;
      unsubscribe = opts.bus.subscribe(subscribeAs, handle);
    },
    async stop(): Promise<void> {
      stopped = true;
      if (unsubscribe !== null) {
        unsubscribe();
        unsubscribe = null;
      }
      if (aplayStdin !== null) {
        aplayStdin.end();
        aplayStdin = null;
      }
    },
  };
}
