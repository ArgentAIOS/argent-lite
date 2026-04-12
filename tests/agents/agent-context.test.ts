import { describe, expect, it } from "vitest";
import {
  AgentContextError,
  createAgentContext,
} from "../../src/agents/agent-context.js";
import { createNoopMemory } from "../../src/agents/__fixtures__/noop-memory.js";
import type { CreateAgentContextOptions } from "../../src/agents/agent-context.js";

describe("createAgentContext", () => {
  it("throws AgentContextError when memory is missing at runtime", () => {
    const bad = {} as unknown as CreateAgentContextOptions;
    expect(() => createAgentContext(bad)).toThrow(AgentContextError);
    expect(() => createAgentContext(bad)).toThrow(
      /requires a memory store/,
    );
  });

  it("throws when memory is explicitly null", () => {
    const bad = { memory: null } as unknown as CreateAgentContextOptions;
    expect(() => createAgentContext(bad)).toThrow(AgentContextError);
  });

  it("returns a context whose memory is the same instance passed in", () => {
    const memory = createNoopMemory();
    const ctx = createAgentContext({ memory });
    expect(ctx.memory).toBe(memory);
  });

  it("round-trips a value through the supplied memory store", async () => {
    const memory = createNoopMemory();
    const ctx = createAgentContext({ memory });
    await ctx.memory.set("a1", "k", { hello: "world" });
    expect(await ctx.memory.get("a1", "k")).toEqual({ hello: "world" });
    expect(await ctx.memory.list("a1")).toEqual(["k"]);
  });

  it("populates defaults for logger, bus, now, and abort", () => {
    const memory = createNoopMemory();
    const ctx = createAgentContext({ memory });
    expect(ctx.logger).toBeDefined();
    expect(ctx.bus).toBeDefined();
    expect(typeof ctx.now()).toBe("number");
    expect(ctx.abort).toBeInstanceOf(AbortSignal);
  });
});
