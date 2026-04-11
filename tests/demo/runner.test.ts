import { describe, expect, it, vi } from "vitest";
import { runDemo, type DemoHelloAgent } from "../../src/demo/runner.js";
import type { AgentContext } from "../../src/agents/index.js";
import type { AgentState } from "../../src/scheduler/index.js";
import { Scheduler } from "../../src/scheduler/index.js";

describe("runDemo", () => {
  it("registers, enqueues, ticks, and returns the agent's greeting (in order)", async () => {
    const calls: string[] = [];

    class MockHelloAgent implements DemoHelloAgent {
      readonly id: string;
      state: AgentState = "init";
      constructor(id: string, _ctx: AgentContext) {
        this.id = id;
      }
      async start(): Promise<void> {
        calls.push("agent.start");
        this.state = "running";
      }
      async stop(): Promise<void> {
        calls.push("agent.stop");
        this.state = "stopped";
      }
      greet(name: string): string {
        calls.push("agent.greet");
        return `hello, ${name}`;
      }
    }

    const registerSpy = vi.spyOn(Scheduler.prototype, "register");
    const enqueueSpy = vi.spyOn(Scheduler.prototype, "enqueue");
    const tickSpy = vi.spyOn(Scheduler.prototype, "tick");

    const logs: string[] = [];
    const result = await runDemo({
      helloAgentCtor: MockHelloAgent,
      logger: (line) => logs.push(line),
    });

    expect(result).toEqual({ status: "ok", greeting: "hello, world" });
    expect(logs).toContain("[demo] hello, world");

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(tickSpy).toHaveBeenCalledTimes(1);

    const registerOrder = registerSpy.mock.invocationCallOrder[0]!;
    const enqueueOrder = enqueueSpy.mock.invocationCallOrder[0]!;
    const tickOrder = tickSpy.mock.invocationCallOrder[0]!;
    expect(registerOrder).toBeLessThan(enqueueOrder);
    expect(enqueueOrder).toBeLessThan(tickOrder);

    const startIdx = calls.indexOf("agent.start");
    const greetIdx = calls.indexOf("agent.greet");
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(greetIdx).toBeGreaterThan(startIdx);

    registerSpy.mockRestore();
    enqueueSpy.mockRestore();
    tickSpy.mockRestore();
  });

  it("uses the real HelloAgent via dynamic import when no ctor is injected", async () => {
    const logs: string[] = [];
    const result = await runDemo({ logger: (line) => logs.push(line) });
    expect(result.status).toBe("ok");
    expect(logs.some((l) => l.startsWith("[demo] hello, world"))).toBe(true);
  });
});
