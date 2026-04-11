import { describe, it, expect, vi } from "vitest";
import { withMemoryLog } from "../../src/router/memory-router.js";
import type { MemoryRouterLogger } from "../../src/router/memory-router.js";
import type { MemoryStore } from "../../src/memory/types.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";

function fakeMemory(overrides: Partial<MemoryStore> = {}): MemoryStore & {
  append: ReturnType<typeof vi.fn>;
} {
  const base: MemoryStore = {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => {}),
    list: vi.fn(async () => []),
    append: vi.fn(async () => {}),
    query: vi.fn(async () => []),
    close: vi.fn(async () => {}),
  };
  return { ...base, ...overrides } as MemoryStore & {
    append: ReturnType<typeof vi.fn>;
  };
}

function fakeLogger(): MemoryRouterLogger & {
  error: ReturnType<typeof vi.fn>;
} {
  return { error: vi.fn() };
}

function innerOk(response: CompletionResponse): Router & {
  route: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
} {
  return {
    route: vi.fn(async (_req: CompletionRequest) => response),
    register: vi.fn((_p: Provider) => {}),
  };
}

function innerThrow(err: Error): Router & {
  route: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
} {
  return {
    route: vi.fn(async (_req: CompletionRequest) => {
      throw err;
    }),
    register: vi.fn((_p: Provider) => {}),
  };
}

describe("withMemoryLog", () => {
  it("appends a router.route event with req, providerId, model on success", async () => {
    const res: CompletionResponse = {
      text: "hello",
      model: "gemma3:1b",
      providerId: "ollama",
    };
    const inner = innerOk(res);
    const memory = fakeMemory();
    const req: CompletionRequest = { prompt: "hi" };

    const router = withMemoryLog({
      inner,
      memory,
      agentId: "router-a",
      now: () => 1234,
      idGen: () => "evt-1",
    });

    const out = await router.route(req);

    expect(out).toBe(res);
    expect(inner.route).toHaveBeenCalledWith(req);
    expect(memory.append).toHaveBeenCalledTimes(1);
    expect(memory.append).toHaveBeenCalledWith("router-a", {
      id: "evt-1",
      ts: 1234,
      kind: "router.route",
      payload: { req, providerId: "ollama", model: "gemma3:1b" },
    });
  });

  it("defaults agentId to 'router' when not provided", async () => {
    const res: CompletionResponse = { text: "x", model: "m", providerId: "p" };
    const inner = innerOk(res);
    const memory = fakeMemory();

    const router = withMemoryLog({ inner, memory, idGen: () => "id" });
    await router.route({ prompt: "p" });

    expect(memory.append.mock.calls[0]?.[0]).toBe("router");
  });

  it("appends a router.error event and rethrows when inner throws", async () => {
    const err = new Error("boom");
    const inner = innerThrow(err);
    const memory = fakeMemory();
    const req: CompletionRequest = { prompt: "hi" };

    const router = withMemoryLog({
      inner,
      memory,
      now: () => 99,
      idGen: () => "evt-err",
    });

    await expect(router.route(req)).rejects.toThrow(/boom/);
    expect(memory.append).toHaveBeenCalledTimes(1);
    expect(memory.append).toHaveBeenCalledWith("router", {
      id: "evt-err",
      ts: 99,
      kind: "router.error",
      payload: { req, error: "boom" },
    });
  });

  it("swallows memory.append errors so routing still succeeds", async () => {
    const res: CompletionResponse = { text: "ok", model: "m", providerId: "p" };
    const inner = innerOk(res);
    const append = vi.fn(async () => {
      throw new Error("memory down");
    });
    const memory = fakeMemory({ append });
    const logger = fakeLogger();

    const router = withMemoryLog({ inner, memory, logger });
    const out = await router.route({ prompt: "hi" });

    expect(out).toBe(res);
    expect(append).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toBe("memory-router.append");
    expect(logger.error.mock.calls[0]?.[1]).toMatchObject({
      kind: "router.route",
      error: "memory down",
    });
  });

  it("swallows memory.append errors on the error path too", async () => {
    const inner = innerThrow(new Error("kaboom"));
    const append = vi.fn(async () => {
      throw new Error("memory down");
    });
    const memory = fakeMemory({ append });
    const logger = fakeLogger();

    const router = withMemoryLog({ inner, memory, logger });
    await expect(router.route({ prompt: "hi" })).rejects.toThrow(/kaboom/);

    expect(append).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[1]).toMatchObject({
      kind: "router.error",
    });
  });

  it("delegates register() to the inner router", () => {
    const inner = innerOk({ text: "x", model: "m", providerId: "p" });
    const memory = fakeMemory();
    const router = withMemoryLog({ inner, memory });
    const provider: Provider = {
      id: "p",
      kind: "local",
      complete: async () => ({ text: "x", model: "m", providerId: "p" }),
      healthCheck: async () => true,
    };

    router.register(provider);
    expect(inner.register).toHaveBeenCalledTimes(1);
    expect(inner.register).toHaveBeenCalledWith(provider);
  });
});
