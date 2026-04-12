import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  VoiceInError,
  createVoiceInChannel,
  type VoiceInSpawn,
  type VoiceInSpawnedProcess,
} from "../../src/channels/voice-in.js";

interface FakeProcess extends VoiceInSpawnedProcess {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function makeFakeSpawn(): {
  spawn: VoiceInSpawn;
  proc: FakeProcess;
  calls: Array<{ cmd: string; args: string[] }>;
} {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const kill = vi.fn((_sig?: NodeJS.Signals) => {
    stdout.end();
    stderr.end();
  });
  const proc: FakeProcess = {
    stdout,
    stderr,
    kill,
    exitCode: null,
  };
  const spawn: VoiceInSpawn = (cmd, args) => {
    calls.push({ cmd, args });
    return proc;
  };
  return { spawn, proc, calls };
}

describe("createVoiceInChannel", () => {
  it("captures audio, uploads to Groq, and publishes a bus prompt message", async () => {
    const { spawn, proc, calls } = makeFakeSpawn();
    const bus = { send: vi.fn() };

    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-key");
      const body = init?.body;
      expect(body).toBeInstanceOf(FormData);
      const form = body as FormData;
      expect(form.get("model")).toBe("whisper-large-v3");
      expect(form.get("language")).toBe("en");
      expect(form.get("response_format")).toBe("json");
      const file = form.get("file");
      expect(file).toBeInstanceOf(Blob);
      return new Response(JSON.stringify({ text: "hello world" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const channel = createVoiceInChannel({
      bus,
      getKey: () => "test-key",
      spawn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1234,
    });

    await channel.start();
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("arecord");
    expect(calls[0].args).toEqual([
      "-q",
      "-f",
      "S16_LE",
      "-r",
      "16000",
      "-c",
      "1",
      "-t",
      "wav",
      "-",
    ]);

    proc.stdout.write(Buffer.from([0x01, 0x02, 0x03, 0x04]));
    proc.stdout.write(Buffer.from([0x05, 0x06]));

    const transcript = await channel.stop();

    expect(transcript).toBe("hello world");
    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(bus.send).toHaveBeenCalledTimes(1);
    expect(bus.send).toHaveBeenCalledWith({
      id: "voice-1234",
      kind: "prompt",
      from: "voice-in",
      to: "router",
      payload: { prompt: "hello world" },
      ts: 1234,
    });
  });

  it("honors agentId override when publishing", async () => {
    const { spawn, proc } = makeFakeSpawn();
    const bus = { send: vi.fn() };
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );

    const channel = createVoiceInChannel({
      bus,
      agentId: "planner",
      getKey: () => "k",
      spawn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 7,
    });

    await channel.start();
    proc.stdout.write(Buffer.from([0xaa]));
    await channel.stop();

    const call = bus.send.mock.calls[0][0] as { to: string };
    expect(call.to).toBe("planner");
  });

  it("abort() kills the recorder and does not transcribe or publish", async () => {
    const { spawn, proc } = makeFakeSpawn();
    const bus = { send: vi.fn() };
    const fetchImpl = vi.fn();

    const channel = createVoiceInChannel({
      bus,
      getKey: () => "test-key",
      spawn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await channel.start();
    proc.stdout.write(Buffer.from([0xff]));
    await channel.abort();

    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(bus.send).not.toHaveBeenCalled();
  });

  it("throws VoiceInError when Groq returns 401", async () => {
    const { spawn, proc } = makeFakeSpawn();
    const bus = { send: vi.fn() };
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
    );

    const channel = createVoiceInChannel({
      bus,
      getKey: () => "bad-key",
      spawn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await channel.start();
    proc.stdout.write(Buffer.from([0x00]));

    await expect(channel.stop()).rejects.toBeInstanceOf(VoiceInError);
    expect(bus.send).not.toHaveBeenCalled();
  });
});
