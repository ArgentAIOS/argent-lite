import { describe, expect, it } from "vitest";
import { HelloAgent } from "../../src/agents/hello-agent.js";
import { MessageBus } from "../../src/agents/message-bus.js";
import { createAgentContext } from "../../src/agents/agent-context.js";
import { createNoopMemory } from "../../src/agents/__fixtures__/noop-memory.js";
import type { AgentMessage } from "../../src/agents/types.js";

function makeHarness() {
  const abort = new AbortController();
  const bus = new MessageBus();
  const ctx = createAgentContext({ bus, abort: abort.signal, memory: createNoopMemory() });
  const agent = new HelloAgent("hello", ctx);
  return { abort, bus, ctx, agent };
}

describe("HelloAgent", () => {
  it("greet() returns the expected greeting", () => {
    const { agent } = makeHarness();
    expect(agent.greet("Jason")).toBe("hello, Jason");
  });

  it("replies to greet messages via the bus", async () => {
    const { bus, agent, abort } = makeHarness();
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    bus.send({
      id: "m1",
      from: "test",
      to: "hello",
      kind: "greet",
      payload: { name: "Jason" },
      ts: 1,
    });

    expect(replies).toHaveLength(1);
    expect(replies[0]?.kind).toBe("greeting");
    expect(replies[0]?.from).toBe("hello");
    expect(replies[0]?.to).toBe("test");
    expect(replies[0]?.payload).toBe("hello, Jason");

    agent.stop();
    await runPromise;
    abort.abort();
  });

  it("stop() unsubscribes — further messages produce no reply", async () => {
    const { bus, agent, abort } = makeHarness();
    const runPromise = agent.start();

    const replies: AgentMessage[] = [];
    bus.subscribe("test", (m) => {
      replies.push(m);
    });

    agent.stop();
    await runPromise;

    bus.send({
      id: "m2",
      from: "test",
      to: "hello",
      kind: "greet",
      payload: { name: "Ghost" },
      ts: 2,
    });

    expect(replies).toHaveLength(0);
    expect(agent.state).toBe("stopped");
    abort.abort();
  });
});
