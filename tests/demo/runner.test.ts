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
      async greet(payload: unknown): Promise<string> {
        calls.push("agent.greet");
        const name = (payload as { name: string }).name;
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

  it("returns skipped and logs the missing-agent line when no ctor is available", async () => {
    const logs: string[] = [];
    const result = await runDemo({
      // Force the dynamic-import branch by passing no ctor; on this slice
      // src/agents/hello-agent.ts does not exist, so the runner must skip.
      logger: (line) => logs.push(line),
    });

    expect(result.status).toBe("skipped");
    expect(logs).toContain("[demo] HelloAgent not available on this branch");
  });
});
