import { BaseAgent } from "./base-agent.js";
import type { AgentContext } from "./agent-context.js";
import type { AgentMessage } from "./types.js";
import type { RuntimeSatelliteClient } from "../satellite/runtime-client.js";
import type { Router } from "../router/index.js";

export interface SatelliteAgentOptions {
  client: RuntimeSatelliteClient;
  fallbackRouter?: Router;
}

interface PromptPayload {
  prompt: string;
}

interface CompletionReplyPayload {
  text: string;
  providerId: string;
}

function isPromptPayload(value: unknown): value is PromptPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { prompt?: unknown }).prompt === "string"
  );
}

function coerceCompletionPayload(value: unknown): CompletionReplyPayload {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string"
  ) {
    const record = value as { text: string; providerId?: unknown };
    const providerId =
      typeof record.providerId === "string" ? record.providerId : "satellite";
    return { text: record.text, providerId };
  }
  throw new Error("satellite agent: malformed completion payload");
}

export class SatelliteAgent extends BaseAgent {
  private readonly client: RuntimeSatelliteClient;
  private readonly fallbackRouter?: Router;
  private resolveRun?: () => void;

  constructor(id: string, ctx: AgentContext, options: SatelliteAgentOptions) {
    super(id, ctx);
    if (!options || typeof options !== "object" || !options.client) {
      throw new Error("SatelliteAgent: options.client is required");
    }
    this.client = options.client;
    this.fallbackRouter = options.fallbackRouter;
  }

  override async onMessage(msg: AgentMessage): Promise<void> {
    if (msg.kind !== "prompt" || !isPromptPayload(msg.payload)) {
      return;
    }
    const prompt = msg.payload.prompt;

    try {
      const res = await this.client.request({
        id: msg.id,
        kind: "completion",
        payload: { prompt },
        ts: this.ctx.now(),
      });
      if (!res.ok) {
        throw new Error(res.error ?? "satellite request failed");
      }
      const payload = coerceCompletionPayload(res.payload);
      this.ctx.bus.send({
        id: `${msg.id}:reply`,
        from: this.id,
        to: msg.from,
        kind: "completion",
        payload,
        ts: this.ctx.now(),
      });
      return;
    } catch (err) {
      if (this.fallbackRouter) {
        try {
          const routed = await this.fallbackRouter.route({ prompt });
          this.ctx.bus.send({
            id: `${msg.id}:reply`,
            from: this.id,
            to: msg.from,
            kind: "completion",
            payload: { text: routed.text, providerId: routed.providerId },
            ts: this.ctx.now(),
          });
          return;
        } catch (fallbackErr) {
          const message =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr);
          this.ctx.bus.send({
            id: `${msg.id}:reply`,
            from: this.id,
            to: msg.from,
            kind: "error",
            payload: { message },
            ts: this.ctx.now(),
          });
          return;
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.bus.send({
        id: `${msg.id}:reply`,
        from: this.id,
        to: msg.from,
        kind: "error",
        payload: { message },
        ts: this.ctx.now(),
      });
    }
  }

  async run(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.resolveRun = resolve;
      if (this.ctx.abort.aborted) {
        resolve();
        return;
      }
      this.ctx.abort.addEventListener("abort", () => resolve(), { once: true });
    });
  }

  override stop(): void {
    super.stop();
    this.resolveRun?.();
  }
}
