import { describe, expect, it, vi } from "vitest";
import { createAgentContext, MessageBus } from "../../src/agents/index.js";
import {
  withRouter,
  type AgentContextWithRouter,
} from "../../src/agents/context-with-router.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";

function mockRouter(): Router {
  return {
    register: vi.fn<(p: Provider) => void>(),
    route: vi.fn<(req: CompletionRequest) => Promise<CompletionResponse>>(
      async () => ({ text: "ok", model: "m", providerId: "mock" }),
    ),
  };
}

describe("withRouter", () => {
  it("wraps an AgentContext with a router while preserving base fields", () => {
    const bus = new MessageBus();
    const abort = new AbortController();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const now = () => 42;
    const ctx = createAgentContext({
      bus,
      abort: abort.signal,
      logger,
      now,
    });
    const router = mockRouter();

    const wrapped: AgentContextWithRouter = withRouter(ctx, router);

    expect(wrapped.router).toBe(router);
    expect(wrapped.bus).toBe(bus);
    expect(wrapped.logger).toBe(logger);
    expect(wrapped.abort).toBe(abort.signal);
    expect(wrapped.now()).toBe(42);
  });

  it("does not mutate the source AgentContext", () => {
    const ctx = createAgentContext();
    const router = mockRouter();
    const wrapped = withRouter(ctx, router);

    expect(wrapped).not.toBe(ctx);
    expect("router" in ctx).toBe(false);
  });

  it("routes through the attached router", async () => {
    const ctx = createAgentContext();
    const router = mockRouter();
    const wrapped = withRouter(ctx, router);

    const res = await wrapped.router.route({ prompt: "hi" });
    expect(res.providerId).toBe("mock");
    expect(router.route).toHaveBeenCalledTimes(1);
  });
});
