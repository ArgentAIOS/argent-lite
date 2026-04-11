import { BaseAgent } from "./base-agent.js";
import type { AgentContext } from "./agent-context.js";
import type { AgentContextWithRouter } from "./context-with-router.js";
import type { AgentMessage } from "./types.js";

export class RouterAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouterAgentError";
  }
}

interface PromptPayload {
  prompt: string;
}

function isPromptPayload(value: unknown): value is PromptPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { prompt?: unknown }).prompt === "string"
  );
}

function hasRouter(ctx: AgentContext): ctx is AgentContextWithRouter {
  const candidate = (ctx as { router?: unknown }).router;
  return typeof candidate === "object" && candidate !== null;
}

export class RouterAgent extends BaseAgent {
  private readonly routerCtx: AgentContextWithRouter;
  private resolveRun?: () => void;

  constructor(id: string, ctx: AgentContext) {
    super(id, ctx);
    if (!hasRouter(ctx)) {
      throw new RouterAgentError("AgentContext missing router");
    }
    this.routerCtx = ctx;
  }

  override async onMessage(msg: AgentMessage): Promise<void> {
    if (!isPromptPayload(msg.payload)) {
      return;
    }
    try {
      const res = await this.routerCtx.router.route({
        prompt: msg.payload.prompt,
      });
      this.routerCtx.bus.send({
        id: `${msg.id}:reply`,
        from: this.id,
        to: msg.from,
        kind: "completion",
        payload: { text: res.text, providerId: res.providerId },
        ts: this.routerCtx.now(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.routerCtx.bus.send({
        id: `${msg.id}:reply`,
        from: this.id,
        to: msg.from,
        kind: "error",
        payload: { message },
        ts: this.routerCtx.now(),
      });
    }
  }

  async run(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.resolveRun = resolve;
      if (this.routerCtx.abort.aborted) {
        resolve();
        return;
      }
      this.routerCtx.abort.addEventListener(
        "abort",
        () => resolve(),
        { once: true },
      );
    });
  }

  override stop(): void {
    super.stop();
    this.resolveRun?.();
  }
}
