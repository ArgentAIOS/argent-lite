import { describe, it, expect, vi } from "vitest";
import { instrumentRouter } from "../../src/router/instrumented-router.js";
import type {
  Logger,
  Metrics,
} from "../../src/router/instrumented-router.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";

function fakeMetrics(): Metrics & {
  inc: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
} {
  return {
    inc: vi.fn(),
    observe: vi.fn(),
  };
}

function fakeLogger(): Logger & {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
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

describe("instrumentRouter", () => {
  it("records success metrics and logs info", async () => {
    const metrics = fakeMetrics();
    const logger = fakeLogger();
    const res: CompletionResponse = {
      text: "ok",
      model: "m",
      providerId: "ollama",
    };
    const inner = innerOk(res);
    let t = 1000;
    const now = () => {
      const v = t;
      t += 25;
      return v;
    };

    const router = instrumentRouter({ inner, metrics, logger, now });
    const out = await router.route({ prompt: "hi" });

    expect(out).toBe(res);
    expect(inner.route).toHaveBeenCalledTimes(1);
    expect(metrics.inc).toHaveBeenCalledWith("router.route.total", {
      policy: "unknown",
    });
    expect(metrics.observe).toHaveBeenCalledWith(
      "router.route.latency_ms",
      25,
      { ok: "true" },
    );
    expect(metrics.inc).toHaveBeenCalledWith("router.route.success");
    expect(logger.info).toHaveBeenCalledWith("router.route", {
      duration_ms: 25,
      ok: true,
      provider: "ollama",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("records failure metrics and logs error when inner throws", async () => {
    const metrics = fakeMetrics();
    const logger = fakeLogger();
    const err = new Error("boom");
    const inner = innerThrow(err);
    let t = 500;
    const now = () => {
      const v = t;
      t += 10;
      return v;
    };

    const router = instrumentRouter({ inner, metrics, logger, now });
    await expect(router.route({ prompt: "hi" })).rejects.toThrow(/boom/);

    expect(metrics.inc).toHaveBeenCalledWith("router.route.total", {
      policy: "unknown",
    });
    expect(metrics.observe).toHaveBeenCalledWith(
      "router.route.latency_ms",
      10,
      { ok: "false" },
    );
    expect(metrics.inc).toHaveBeenCalledWith("router.route.failure");
    expect(metrics.inc).not.toHaveBeenCalledWith("router.route.success");
    expect(logger.error).toHaveBeenCalledTimes(1);
    const errorCall = logger.error.mock.calls[0];
    expect(errorCall?.[0]).toBe("router.route");
    expect(errorCall?.[1]).toMatchObject({
      duration_ms: 10,
      ok: false,
      error: "boom",
    });
  });

  it("delegates register() to the inner router", () => {
    const inner = innerOk({ text: "x", model: "m", providerId: "p" });
    const router = instrumentRouter({ inner });
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

  it("works without metrics or logger (no-op safe)", async () => {
    const res: CompletionResponse = {
      text: "ok",
      model: "m",
      providerId: "ollama",
    };
    const inner = innerOk(res);
    const router = instrumentRouter({ inner });
    const out = await router.route({ prompt: "hi" });
    expect(out).toBe(res);
  });
});
