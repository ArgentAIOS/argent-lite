import { describe, expect, it, vi } from "vitest";
import { SatelliteAgent } from "../../src/agents/satellite-agent.js";
import { MessageBus } from "../../src/agents/message-bus.js";
import { createAgentContext } from "../../src/agents/agent-context.js";
import { createNoopMemory } from "../../src/agents/__fixtures__/noop-memory.js";
import type {
  RuntimeSatelliteClient,
} from "../../src/satellite/runtime-client.js";
import type {
  SatelliteRequest,
  SatelliteResponse,
} from "../../src/satellite/types.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";
import type { AgentMessage } from "../../src/agents/types.js";

function makeClient(
  request: (req: SatelliteRequest) => Promise<SatelliteResponse>,
): RuntimeSatelliteClient {
  return {
    request: vi.fn(request),
    ping: vi.fn(async () => true),
  };
}

function makeRouter(
  route: (req: CompletionRequest) => Promise<CompletionResponse>,
): Router {
  return {
    register: vi.fn<(p: Provider) => void>(),
    route: vi.fn(route),
  };
}

function makeHarness(
  client: RuntimeSatelliteClient,
  fallbackRouter?: Router,
) {
  const abort = new AbortController();
  const bus = new MessageBus();
  const ctx = createAgentContext({
    bus,
    abort: abort.signal,
    memory: createNoopMemory(),
    now: () => 42,
  });
  const agent = new SatelliteAgent("router", ctx, { client, fallbackRouter });
  return { abort, bus, agent };
}

function sendPrompt(
  bus: MessageBus,
  id: string,
  prompt: string,
): void {
  bus.send({
    id,
    from: "test",
    to: "router",
    kind: "prompt",
    payload: { prompt },
    ts: 1,
  });
}

describe("SatelliteAgent", () => {
  it("forwards prompt to satellite client and replies with completion", async () => {
    const client = makeClient(async (req) => ({
      id: req.id,
      ok: true,
      payload: { text: "sat:hello", providerId: "mac-brain" },
    }));
    const { bus, agent, abort } = makeHarness(client);
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    sendPrompt(bus, "m1", "hello");

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    expect(client.request).toHaveBeenCalledWith({
      id: "m1",
      kind: "completion",
      payload: { prompt: "hello" },
      ts: 42,
    });
    const reply = replies[0];
    expect(reply?.kind).toBe("completion");
    expect(reply?.from).toBe("router");
    expect(reply?.to).toBe("test");
    expect(reply?.payload).toEqual({
      text: "sat:hello",
      providerId: "mac-brain",
    });

    agent.stop();
    await runPromise;
    abort.abort();
  });

  it("replies with error when satellite fails and no fallback is configured", async () => {
    const client = makeClient(async () => {
      throw new Error("offline");
    });
    const { bus, agent, abort } = makeHarness(client);
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    sendPrompt(bus, "m2", "ping");

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    const reply = replies[0];
    expect(reply?.kind).toBe("error");
    expect(reply?.payload).toEqual({ message: "offline" });

    agent.stop();
    await runPromise;
    abort.abort();
  });

  it("falls back to local router when satellite fails and fallback is provided", async () => {
    const client = makeClient(async () => {
      throw new Error("network down");
    });
    const router = makeRouter(async () => ({
      text: "local:fallback",
      model: "stub",
      providerId: "local-stub",
    }));
    const { bus, agent, abort } = makeHarness(client, router);
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    sendPrompt(bus, "m3", "fallback-me");

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    expect(router.route).toHaveBeenCalledWith({ prompt: "fallback-me" });
    const reply = replies[0];
    expect(reply?.kind).toBe("completion");
    expect(reply?.payload).toEqual({
      text: "local:fallback",
      providerId: "local-stub",
    });

    agent.stop();
    await runPromise;
    abort.abort();
  });

  it("propagates satellite response.ok=false as an error with server message", async () => {
    const client = makeClient(async (req) => ({
      id: req.id,
      ok: false,
      error: "mac brain busy",
    }));
    const { bus, agent, abort } = makeHarness(client);
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    sendPrompt(bus, "m4", "hi");

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    const reply = replies[0];
    expect(reply?.kind).toBe("error");
    expect(reply?.payload).toEqual({ message: "mac brain busy" });

    agent.stop();
    await runPromise;
    abort.abort();
  });
});
