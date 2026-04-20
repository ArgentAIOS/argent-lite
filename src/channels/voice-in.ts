import { spawn as nodeSpawn } from "node:child_process";
import { PassThrough } from "node:stream";

export interface VoiceInBus {
  send(msg: unknown): void;
}

export interface VoiceInSpawnedProcess {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill: (sig?: NodeJS.Signals) => void;
  exitCode: number | null;
}

export type VoiceInSpawn = (
  cmd: string,
  args: string[],
) => VoiceInSpawnedProcess;

export interface VoiceInOptions {
  bus: VoiceInBus;
  getKey: () => Promise<string> | string;
  agentId?: string;
  model?: string;
  language?: string;
  spawn?: VoiceInSpawn;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface VoiceInChannel {
  start(): Promise<void>;
  stop(): Promise<string>;
  abort(): Promise<void>;
}

export class VoiceInError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "VoiceInError";
    this.status = status;
  }
}

const ARECORD_ARGS = [
  "-q",
  "-f",
  "S16_LE",
  "-r",
  "16000",
  "-c",
  "1",
  "-t",
  "wav",
  "-",
];

const TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

interface CaptureState {
  proc: VoiceInSpawnedProcess;
  chunks: Buffer[];
  ended: Promise<void>;
}

function isTranscriptionResponse(
  value: unknown,
): value is { text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

const defaultSpawn: VoiceInSpawn = (cmd, args) => {
  const child = nodeSpawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  return {
    stdout: child.stdout,
    stderr: child.stderr,
    kill: (sig) => {
      child.kill(sig);
    },
    get exitCode(): number | null {
      return child.exitCode;
    },
  } as VoiceInSpawnedProcess;
};

export function createVoiceInChannel(opts: VoiceInOptions): VoiceInChannel {
  const bus = opts.bus;
  const getKey = opts.getKey;
  const agentId = opts.agentId ?? "router";
  const model = opts.model ?? "whisper-large-v3";
  const language = opts.language ?? "en";
  const spawn = opts.spawn ?? defaultSpawn;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => Date.now());

  let state: CaptureState | null = null;

  async function beginCapture(): Promise<void> {
    if (state !== null) {
      throw new VoiceInError("voice-in already capturing");
    }
    const proc = spawn("arecord", ARECORD_ARGS);
    const chunks: Buffer[] = [];
    const ended = new Promise<void>((resolve) => {
      proc.stdout.on("data", (chunk: Buffer | string) => {
        const buf =
          typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
        chunks.push(buf);
      });
      proc.stdout.on("end", () => {
        resolve();
      });
      proc.stdout.on("close", () => {
        resolve();
      });
      proc.stdout.on("error", () => {
        resolve();
      });
    });
    // Drain stderr so it does not stall the child process.
    const stderrDrain = new PassThrough();
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderrDrain.write(chunk);
    });
    proc.stderr.on("error", () => {});
    state = { proc, chunks, ended };
  }

  async function endCapture(): Promise<string> {
    const active = state;
    if (active === null) {
      throw new VoiceInError("voice-in not capturing");
    }
    state = null;

    active.proc.kill("SIGTERM");
    await active.ended;

    const pcm = Buffer.concat(active.chunks);
    const key = await getKey();

    const form = new FormData();
    const blob = new Blob([pcm], { type: "audio/wav" });
    form.append("file", blob, "capture.wav");
    form.append("model", model);
    form.append("language", language);
    form.append("response_format", "json");

    const res = await fetchImpl(TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: form,
    });

    if (!res.ok) {
      throw new VoiceInError(
        `groq transcription failed: ${res.status}`,
        res.status,
      );
    }

    const parsed: unknown = await res.json();
    if (!isTranscriptionResponse(parsed)) {
      throw new VoiceInError("groq transcription returned invalid payload");
    }

    const text = parsed.text;
    const ts = now();
    bus.send({
      id: `voice-${ts}`,
      kind: "prompt",
      from: "voice-in",
      to: agentId,
      payload: { prompt: text },
      ts,
    });
    return text;
  }

  async function abortCapture(): Promise<void> {
    const active = state;
    if (active === null) {
      return;
    }
    state = null;
    active.proc.kill("SIGTERM");
    await active.ended;
  }

  return {
    start: beginCapture,
    stop: endCapture,
    abort: abortCapture,
  };
}
