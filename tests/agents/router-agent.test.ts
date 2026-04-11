import { describe, expect, it, vi } from "vitest";
import { RouterAgent, RouterAgentError } from "../../src/agents/router-agent.js";
import { MessageBus } from "../../src/agents/message-bus.js";
import { createAgentContext } from "../../src/agents/agent-context.js";
import { withRouter } from "../../src/agents/context-with-router.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";
import type { AgentMessage } from "../../src/agents/types.js";

function makeRouter(
  route: (req: CompletionRequest) => Promise<CompletionResponse>,
): Router {
  return {
    register: vi.fn<(p: Provider) => void>(),
    route: vi.fn(route),
  };
}

function makeHarness(router: Router) {
  const abort = new AbortController();
  const bus = new MessageBus();
  const base = createAgentContext({ bus, abort: abort.signal });
  const ctx = withRouter(base, router);
  const agent = new RouterAgent("router", ctx);
  return { abort, bus, ctx, agent };
}

describe("RouterAgent", () => {
  it("throws RouterAgentError when ctx has no router", () => {
    const ctx = createAgentContext();
    expect(() => new RouterAgent("router", ctx)).toThrow(RouterAgentError);
    expect(() => new RouterAgent("router", ctx)).toThrow(
      "AgentContext missing router",
    );
  });

  it("routes a prompt and replies with completion", async () => {
    const router = makeRouter(async () => ({
      text: "mocked",
      model: "m",
      providerId: "mock",
    }));
    const { bus, agent, abort } = makeHarness(router);
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    bus.send({
      id: "m1",
      from: "test",
      to: "router",
      kind: "prompt",
      payload: { prompt: "hello" },
      ts: 1,
    });

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    expect(router.route).toHaveBeenCalledWith({ prompt: "hello" });
    const reply = replies[0];
    expect(reply?.kind).toBe("completion");
    expect(reply?.from).toBe("router");
    expect(reply?.to).toBe("test");
    expect(reply?.payload).toEqual({ text: "mocked", providerId: "mock" });

    agent.stop();
    await runPromise;
    abort.abort();
  });

  it("replies with error when router.route throws", async () => {
    const router = makeRouter(async () => {
      throw new Error("boom");
    });
    const { bus, agent, abort } = makeHarness(router);
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    bus.send({
      id: "m2",
      from: "test",
      to: "router",
      kind: "prompt",
      payload: { prompt: "fail" },
      ts: 2,
    });

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    const reply = replies[0];
    expect(reply?.kind).toBe("error");
    expect(reply?.payload).toEqual({ message: "boom" });

    agent.stop();
    await runPromise;
    abort.abort();
  });
});
