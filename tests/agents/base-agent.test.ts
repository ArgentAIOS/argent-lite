import { describe, expect, it } from "vitest";
import {
  BaseAgent,
  createAgentContext,
  MessageBus,
  type AgentContext,
  type AgentMessage,
} from "../../src/agents/index.js";
import { createNoopMemory } from "../../src/agents/__fixtures__/noop-memory.js";

class EchoAgent extends BaseAgent {
  public readonly received: AgentMessage[] = [];

  async run(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (this.ctx.abort.aborted) {
        resolve();
        return;
      }
      this.ctx.abort.addEventListener("abort", () => resolve(), { once: true });
    });
  }

  override onMessage(msg: AgentMessage): void {
    this.received.push(msg);
    this.ctx.bus.send({
      id: `${msg.id}:echo`,
      from: this.id,
      to: msg.from,
      kind: msg.kind,
      payload: msg.payload,
      ts: this.ctx.now(),
    });
  }
}

function makeCtx(abort: AbortController, bus = new MessageBus()): AgentContext {
  return createAgentContext({ bus, abort: abort.signal, memory: createNoopMemory() });
}

describe("BaseAgent", () => {
  it("start transitions init -> running and stop -> stopped", async () => {
    const abort = new AbortController();
    const ctx = makeCtx(abort);
    const agent = new EchoAgent("a", ctx);

    expect(agent.state).toBe("init");
    const runPromise = agent.start();
    expect(agent.state).toBe("running");

    agent.stop();
    expect(agent.state).toBe("stopped");

    abort.abort();
    await runPromise;
  });

  it("illegal transition throws", () => {
    const abort = new AbortController();
    const ctx = makeCtx(abort);
    const agent = new EchoAgent("a", ctx);

    expect(() => agent.suspend()).toThrow(/cannot suspend from state "init"/);
    expect(() => agent.stop()).toThrow(/cannot stop from state "init"/);

    void agent.start().catch(() => undefined);
    expect(() => agent.start()).toThrow(/cannot start from state "running"/);

    agent.suspend();
    expect(() => agent.suspend()).toThrow(/cannot suspend from state "suspended"/);
    agent.resume();
    agent.stop();
    expect(() => agent.start()).toThrow(/cannot start from state "stopped"/);

    abort.abort();
  });

  it("run() resolves when abort fires and state settles to stopped", async () => {
    const abort = new AbortController();
    const ctx = makeCtx(abort);
    const agent = new EchoAgent("a", ctx);

    const runPromise = agent.start();
    abort.abort();
    await expect(runPromise).resolves.toBeUndefined();
    expect(agent.state).toBe("stopped");
  });

  it("abort propagates to ctx.abort.aborted", async () => {
    const abort = new AbortController();
    const ctx = makeCtx(abort);
    const agent = new EchoAgent("a", ctx);
    const runPromise = agent.start();

    expect(ctx.abort.aborted).toBe(false);
    abort.abort();
    expect(ctx.abort.aborted).toBe(true);
    await runPromise;
  });

  it("onMessage echoes received messages", async () => {
    const abort = new AbortController();
    const bus = new MessageBus();
    const ctx = makeCtx(abort, bus);
    const agent = new EchoAgent("echo", ctx);
    const runPromise = agent.start();

    const seen: AgentMessage[] = [];
    bus.subscribe("caller", (m) => {
      seen.push(m);
    });

    bus.send({
      id: "m1",
      from: "caller",
      to: "echo",
      kind: "ping",
      payload: { hello: "world" },
      ts: 1,
    });

    expect(agent.received).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.from).toBe("echo");
    expect(seen[0]?.to).toBe("caller");
    expect(seen[0]?.payload).toEqual({ hello: "world" });

    abort.abort();
    await runPromise;
  });
});
