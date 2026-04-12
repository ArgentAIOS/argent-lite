import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MessageBus } from "../../src/agents/index.js";
import type { AgentMessage } from "../../src/agents/index.js";
import { FileWatchChannel } from "../../src/channels/file-watch.js";

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), "file-watch-"));
}

async function makeFiles(dir: string): Promise<{ inPath: string; outPath: string }> {
  const inPath = join(dir, "in.txt");
  const outPath = join(dir, "out.txt");
  await fs.writeFile(inPath, "");
  await fs.writeFile(outPath, "");
  return { inPath, outPath };
}

describe("FileWatchChannel", () => {
  it("delivers each new line appended to inPath as a prompt message", async () => {
    const dir = await makeTempDir();
    const { inPath, outPath } = await makeFiles(dir);
    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    bus.subscribe("agent-x", (msg) => {
      received.push(msg);
    });

    const channel = new FileWatchChannel({
      agentId: "agent-x",
      bus,
      inPath,
      outPath,
      pollMs: 50,
      now: () => 99,
    });
    await channel.start();

    await fs.appendFile(inPath, "first line\nsecond line\n");
    await wait(200);

    expect(received).toHaveLength(2);
    const [first, second] = received;
    expect(first!.kind).toBe("prompt");
    expect(first!.to).toBe("agent-x");
    expect(first!.from).toBe("cli");
    expect(first!.payload).toEqual({ prompt: "first line" });
    expect(first!.ts).toBe(99);
    expect(second!.payload).toEqual({ prompt: "second line" });

    await channel.stop();
  });

  it("seeks to end on start so pre-existing content is ignored", async () => {
    const dir = await makeTempDir();
    const inPath = join(dir, "in.txt");
    const outPath = join(dir, "out.txt");
    await fs.writeFile(inPath, "already here\n");
    await fs.writeFile(outPath, "");

    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    bus.subscribe("agent-x", (msg) => {
      received.push(msg);
    });

    const channel = new FileWatchChannel({
      agentId: "agent-x",
      bus,
      inPath,
      outPath,
      pollMs: 50,
    });
    await channel.start();
    await wait(150);
    expect(received).toHaveLength(0);

    await fs.appendFile(inPath, "fresh\n");
    await wait(200);
    expect(received).toHaveLength(1);
    expect(received[0]!.payload).toEqual({ prompt: "fresh" });

    await channel.stop();
  });

  it("appends completion replies addressed to replyTo into outPath", async () => {
    const dir = await makeTempDir();
    const { inPath, outPath } = await makeFiles(dir);
    const bus = new MessageBus();

    const channel = new FileWatchChannel({
      agentId: "agent-x",
      bus,
      inPath,
      outPath,
      pollMs: 50,
    });
    await channel.start();

    bus.send({
      id: "r1",
      from: "agent-x",
      to: "cli",
      kind: "completion",
      payload: { text: "hello out" },
      ts: 1,
    });
    await wait(100);

    const body = await fs.readFile(outPath, "utf8");
    expect(body).toBe("hello out\n");

    await channel.stop();
  });

  it("writes [error] prefixed lines for error replies", async () => {
    const dir = await makeTempDir();
    const { inPath, outPath } = await makeFiles(dir);
    const bus = new MessageBus();

    const channel = new FileWatchChannel({
      agentId: "agent-x",
      bus,
      inPath,
      outPath,
      pollMs: 50,
    });
    await channel.start();

    bus.send({
      id: "r2",
      from: "agent-x",
      to: "cli",
      kind: "error",
      payload: { message: "boom" },
      ts: 2,
    });
    await wait(100);

    const body = await fs.readFile(outPath, "utf8");
    expect(body).toBe("[error] boom\n");

    await channel.stop();
  });

  it("stop() halts polling so later file writes are not dispatched", async () => {
    const dir = await makeTempDir();
    const { inPath, outPath } = await makeFiles(dir);
    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    bus.subscribe("agent-x", (msg) => {
      received.push(msg);
    });

    const channel = new FileWatchChannel({
      agentId: "agent-x",
      bus,
      inPath,
      outPath,
      pollMs: 50,
    });
    await channel.start();

    await fs.appendFile(inPath, "before\n");
    await wait(150);
    expect(received).toHaveLength(1);

    await channel.stop();

    await fs.appendFile(inPath, "after\n");
    await wait(200);
    expect(received).toHaveLength(1);
  });
});
