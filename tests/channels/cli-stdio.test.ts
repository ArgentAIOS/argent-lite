import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { MessageBus } from "../../src/agents/index.js";
import type { AgentMessage } from "../../src/agents/index.js";
import { CliStdioChannel } from "../../src/channels/index.js";

function collectStdout(stream: PassThrough): () => string {
  const chunks: Buffer[] = [];
  stream.on("data", (c: Buffer) => {
    chunks.push(c);
  });
  return () => Buffer.concat(chunks).toString("utf8");
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("CliStdioChannel", () => {
  it("turns a stdin line into an AgentMessage on the bus", async () => {
    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    bus.subscribe("hello", (msg) => {
      received.push(msg);
    });

    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const channel = new CliStdioChannel({
      agentId: "hello",
      bus,
      stdin,
      stdout,
      now: () => 42,
    });

    await channel.start();
    stdin.write("hi there\n");
    await flush();

    expect(received).toHaveLength(1);
    const msg = received[0]!;
    expect(msg.from).toBe("cli");
    expect(msg.to).toBe("hello");
    expect(msg.kind).toBe("prompt");
    expect(msg.payload).toEqual({ prompt: "hi there" });
    expect(msg.ts).toBe(42);
    expect(typeof msg.id).toBe("string");
    expect(msg.id.length).toBeGreaterThan(0);

    await channel.stop();
  });

  it("writes completion replies addressed to cli to stdout", async () => {
    const bus = new MessageBus();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const read = collectStdout(stdout);

    const channel = new CliStdioChannel({
      agentId: "hello",
      bus,
      stdin,
      stdout,
    });
    await channel.start();

    bus.send({
      id: "r1",
      from: "hello",
      to: "cli",
      kind: "completion",
      payload: { text: "hello back" },
      ts: 1,
    });
    await flush();

    expect(read()).toBe("hello back\n");

    await channel.stop();
  });

  it("writes error replies with [error] prefix", async () => {
    const bus = new MessageBus();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const read = collectStdout(stdout);

    const channel = new CliStdioChannel({
      agentId: "hello",
      bus,
      stdin,
      stdout,
    });
    await channel.start();

    bus.send({
      id: "r2",
      from: "hello",
      to: "cli",
      kind: "error",
      payload: { message: "boom" },
      ts: 2,
    });
    await flush();

    expect(read()).toBe("[error] boom\n");

    await channel.stop();
  });

  it("stop() unsubscribes so later replies are ignored", async () => {
    const bus = new MessageBus();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const read = collectStdout(stdout);

    const channel = new CliStdioChannel({
      agentId: "hello",
      bus,
      stdin,
      stdout,
    });
    await channel.start();
    await channel.stop();

    bus.send({
      id: "r3",
      from: "hello",
      to: "cli",
      kind: "completion",
      payload: { text: "after stop" },
      ts: 3,
    });
    await flush();

    expect(read()).toBe("");
  });
});
