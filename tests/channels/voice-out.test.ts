import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createVoiceOutChannel } from "../../src/channels/voice-out.js";

type BusHandler = (msg: unknown) => void;

interface FakeBus {
  subscribe(id: string, h: BusHandler): () => void;
  emit(id: string, msg: unknown): void;
  size(): number;
}

function makeBus(): FakeBus {
  const handlers = new Map<string, BusHandler>();
  return {
    subscribe(id, h) {
      handlers.set(id, h);
      return () => {
        handlers.delete(id);
      };
    },
    emit(id, msg) {
      const h = handlers.get(id);
      if (h) h(msg);
    },
    size() {
      return handlers.size;
    },
  };
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function makeFakeFetch(
  chunks: Uint8Array[],
): { fn: ReturnType<typeof vi.fn>; impl: typeof fetch } {
  const fn = vi.fn(async () => new Response(streamOf(chunks), { status: 200 }));
  return { fn, impl: fn as unknown as typeof fetch };
}

interface SpawnRecord {
  cmd: string;
  args: string[];
  stream: PassThrough;
  chunks: Buffer[];
}

function makeSpawn(): {
  fn: (cmd: string, args: string[]) => NodeJS.WritableStream;
  calls: SpawnRecord[];
} {
  const calls: SpawnRecord[] = [];
  const fn = (cmd: string, args: string[]): NodeJS.WritableStream => {
    const stream = new PassThrough();
    const rec: SpawnRecord = { cmd, args, stream, chunks: [] };
    stream.on("data", (c: Buffer) => {
      rec.chunks.push(c);
    });
    calls.push(rec);
    return stream;
  };
  return { fn, calls };
}

describe("createVoiceOutChannel", () => {
  it("streams completion text to ElevenLabs and pipes PCM to aplay", async () => {
    const bus = makeBus();
    const pcm = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const { fn: fetchFn, impl: fetchImpl } = makeFakeFetch([pcm]);
    const { fn: spawnFn, calls: spawnCalls } = makeSpawn();

    const channel = createVoiceOutChannel({
      bus,
      getKey: () => "xi-key-123",
      fetchImpl,
      spawn: spawnFn,
    });

    await channel.start();
    expect(bus.size()).toBe(1);

    bus.emit("cli", { kind: "completion", payload: { text: "hello world" } });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(spawnCalls).toHaveLength(1);
      const received = spawnCalls[0]!.chunks.reduce((n, c) => n + c.byteLength, 0);
      expect(received).toBe(pcm.byteLength);
    });

    const [calledUrl, calledInit] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(calledUrl).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream?output_format=pcm_22050",
    );
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("xi-key-123");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(calledInit.body as string) as {
      text: string;
      model_id: string;
    };
    expect(body).toEqual({ text: "hello world", model_id: "eleven_flash_v2_5" });

    expect(spawnCalls[0]!.cmd).toBe("aplay");
    expect(spawnCalls[0]!.args).toEqual([
      "-q",
      "-f",
      "S16_LE",
      "-r",
      "22050",
      "-c",
      "1",
    ]);

    const collected = Buffer.concat(spawnCalls[0]!.chunks);
    expect(collected.equals(Buffer.from(pcm))).toBe(true);

    await channel.stop();
  });

  it("speaks an apology when an error message arrives", async () => {
    const bus = makeBus();
    const { fn: fetchFn, impl: fetchImpl } = makeFakeFetch([new Uint8Array([9, 9])]);
    const { fn: spawnFn, calls: spawnCalls } = makeSpawn();

    const channel = createVoiceOutChannel({
      bus,
      getKey: () => "k",
      fetchImpl,
      spawn: spawnFn,
    });
    await channel.start();

    bus.emit("cli", { kind: "error", payload: { message: "boom" } });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(spawnCalls).toHaveLength(1);
    });

    const body = JSON.parse(
      (fetchFn.mock.calls[0]![1] as RequestInit).body as string,
    ) as { text: string; model_id: string };
    expect(body.text.toLowerCase()).toContain("sorry");
    expect(body.model_id).toBe("eleven_flash_v2_5");

    await channel.stop();
  });

  it("stop() unsubscribes from the bus and closes the aplay stream", async () => {
    const bus = makeBus();
    const { impl: fetchImpl } = makeFakeFetch([new Uint8Array([1, 2])]);
    const { fn: spawnFn, calls: spawnCalls } = makeSpawn();

    const channel = createVoiceOutChannel({
      bus,
      getKey: () => "k",
      fetchImpl,
      spawn: spawnFn,
    });
    await channel.start();
    expect(bus.size()).toBe(1);

    bus.emit("cli", { kind: "completion", payload: { text: "warm up" } });
    await vi.waitFor(() => {
      expect(spawnCalls).toHaveLength(1);
    });

    const endSpy = vi.spyOn(spawnCalls[0]!.stream, "end");
    await channel.stop();

    expect(bus.size()).toBe(0);
    expect(endSpy).toHaveBeenCalled();
  });
});
