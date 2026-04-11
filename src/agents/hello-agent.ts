import { BaseAgent } from "./base-agent.js";
import type { AgentContext } from "./agent-context.js";
import type { AgentMessage } from "./types.js";

interface GreetPayload {
  name: string;
}

function isGreetPayload(value: unknown): value is GreetPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

export class HelloAgent extends BaseAgent {
  private resolveRun?: () => void;

  constructor(id: string, ctx: AgentContext) {
    super(id, ctx);
  }

  greet(name: string): string {
    return `hello, ${name}`;
  }

  override onMessage(msg: AgentMessage): void {
    if (!isGreetPayload(msg.payload)) {
      return;
    }
    this.ctx.bus.send({
      id: `${msg.id}:reply`,
      from: this.id,
      to: msg.from,
      kind: "greeting",
      payload: this.greet(msg.payload.name),
      ts: this.ctx.now(),
    });
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
