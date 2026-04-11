import { describe, expect, it } from "vitest";
import { MessageBus } from "../../src/agents/index.js";
import type { AgentMessage, MessageHandler } from "../../src/agents/index.js";
import { HttpChannel } from "../../src/channels/http.js";
import type { ChannelBus } from "../../src/channels/types.js";

function url(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

describe("HttpChannel", () => {
  it("delivers a prompt over the bus and returns the completion", async () => {
    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    bus.subscribe("agent-1", (msg) => {
      received.push(msg);
      bus.send({
        id: `${msg.id}:reply`,
        from: "agent-1",
        to: msg.from,
        kind: "completion",
        payload: { text: `echo:${(msg.payload as { prompt: string }).prompt}` },
        ts: 99,
      });
    });

    const channel = new HttpChannel({ agentId: "agent-1", bus });
    await channel.start();
    const port = channel.port;

    const res = await fetch(url(port, "/v1/prompt"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "ping" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trace_id: string; text: string };
    expect(body.text).toBe("echo:ping");
    expect(typeof body.trace_id).toBe("string");
    expect(body.trace_id.length).toBeGreaterThan(0);

    expect(received).toHaveLength(1);
    expect(received[0]!.kind).toBe("prompt");
    expect(received[0]!.to).toBe("agent-1");
    expect(received[0]!.payload).toEqual({ prompt: "ping" });

    await channel.stop();
  });

  it("returns 404 on unknown path", async () => {
    const bus = new MessageBus();
    const channel = new HttpChannel({ agentId: "agent-1", bus });
    await channel.start();

    const res = await fetch(url(channel.port, "/nope"), { method: "POST" });
    expect(res.status).toBe(404);
    await res.text();

    await channel.stop();
  });

  it("returns 400 on bad body", async () => {
    const bus = new MessageBus();
    const channel = new HttpChannel({ agentId: "agent-1", bus });
    await channel.start();

    const resJson = await fetch(url(channel.port, "/v1/prompt"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(resJson.status).toBe(400);
    await resJson.text();

    const resShape = await fetch(url(channel.port, "/v1/prompt"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nope: 1 }),
    });
    expect(resShape.status).toBe(400);
    await resShape.text();

    await channel.stop();
  });

  it("returns 504 when no reply arrives within the timeout", async () => {
    const silentBus: ChannelBus = {
      send(_msg: AgentMessage): void {},
      subscribe(_id: string, _handler: MessageHandler): () => void {
        return () => {};
      },
    };

    const channel = new HttpChannel({
      agentId: "agent-1",
      bus: silentBus,
      timeoutMs: 50,
    });
    await channel.start();

    const res = await fetch(url(channel.port, "/v1/prompt"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "ping" }),
    });
    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("timeout");

    await channel.stop();
  });
});
