export type KioskState = "idle" | "listening" | "thinking" | "speaking";

export interface KioskStatus {
  state: KioskState;
  statusText: string;
}

export interface KioskTalkStartResult {
  ok: boolean;
  error?: string;
}

export interface KioskTalkEndResult {
  ok: boolean;
  transcript?: string;
  error?: string;
}

export interface KioskInterruptResult {
  ok: boolean;
  error?: string;
}

export interface KioskHandlers {
  status(): Promise<KioskStatus>;
  talkStart(): Promise<KioskTalkStartResult>;
  talkEnd(): Promise<KioskTalkEndResult>;
  interrupt(): Promise<KioskInterruptResult>;
}

export interface KioskHandlerOptions {
  startCapture?: () => Promise<void>;
  stopCapture?: () => Promise<string | undefined>;
  cancelSpeech?: () => Promise<void>;
  getState?: () => KioskState;
}

const STATUS_TEXT: Record<KioskState, string> = {
  idle: "Tap to talk",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createKioskHandlers(
  opts: KioskHandlerOptions = {},
): KioskHandlers {
  let state: KioskState = "idle";

  const startCapture =
    opts.startCapture ??
    (async (): Promise<void> => {
      process.stdout.write("[kiosk] mic capture not wired yet\n");
    });
  const stopCapture =
    opts.stopCapture ??
    (async (): Promise<string | undefined> => {
      process.stdout.write("[kiosk] mic capture not wired yet\n");
      return undefined;
    });
  const cancelSpeech =
    opts.cancelSpeech ??
    (async (): Promise<void> => {
      process.stdout.write("[kiosk] speech cancel not wired yet\n");
    });

  function currentState(): KioskState {
    return opts.getState ? opts.getState() : state;
  }

  return {
    async status() {
      const s = currentState();
      return { state: s, statusText: STATUS_TEXT[s] };
    },

    async talkStart() {
      if (currentState() !== "idle") {
        return { ok: false, error: `cannot start from state ${currentState()}` };
      }
      try {
        state = "listening";
        await startCapture();
        return { ok: true };
      } catch (err) {
        state = "idle";
        return { ok: false, error: errorMessage(err) };
      }
    },

    async talkEnd() {
      if (currentState() !== "listening") {
        return {
          ok: false,
          error: `cannot end from state ${currentState()}`,
        };
      }
      state = "thinking";
      try {
        const transcript = await stopCapture();
        if (transcript && transcript.length > 0) {
          state = "speaking";
          return { ok: true, transcript };
        }
        state = "idle";
        return { ok: true };
      } catch (err) {
        state = "idle";
        return { ok: false, error: errorMessage(err) };
      }
    },

    async interrupt() {
      try {
        await cancelSpeech();
        state = "idle";
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
  };
}
