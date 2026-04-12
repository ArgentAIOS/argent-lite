import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { bootRuntime } from "../../src/integration/runtime.js";
import type { RuntimeSatelliteClient } from "../../src/satellite/runtime-client.js";
import type {
  SatelliteRequest,
  SatelliteResponse,
} from "../../src/satellite/types.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../../src/router/types.js";

class LocalFallbackProvider implements Provider {
  readonly id = "local-fallback";
  readonly kind = "local" as const;
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    return {
      text: `local:${req.prompt}`,
      model: "fallback-model",
      providerId: this.id,
    };
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

function makeStubClient(
  request: (req: SatelliteRequest) => Promise<SatelliteResponse>,
): RuntimeSatelliteClient {
  return {
    request: vi.fn(request),
    ping: vi.fn(async () => true),
  };
}

function readOneLine(stream: PassThrough): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    const onData = (chunk: Buffer | string): void => {
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        stream.off("data", onData);
        resolve(buf.slice(0, nl));
      }
    };
    stream.on("data", onData);
  });
}

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

describe("bootRuntime satellite mode", () => {
  it("routes prompts through the injected satellite client", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const satelliteClient = makeStubClient(async (req) => ({
      id: req.id,
      ok: true,
      payload: { text: "sat:hello", providerId: "mac-brain" },
    }));

    const runtime = await bootRuntime({
      stdin,
      stdout,
      mode: "satellite",
      satellite: {
        baseUrl: "http://unused.invalid",
        secret: "test-secret",
      },
      satelliteClient,
    });

    const replyPromise = readOneLine(stdout);
    stdin.write("hello\n");
    const reply = await withTimeout(replyPromise, 500, "satellite reply");
    expect(reply).toBe("sat:hello");
    expect(satelliteClient.request).toHaveBeenCalledTimes(1);

    const events = await runtime.memory.query("router", { limit: 50 });
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("channel.in")).toBe(true);
    expect(kinds.has("channel.out")).toBe(true);

    await withTimeout(runtime.shutdown(), 500, "runtime shutdown");
  });

  it("falls back to the local router when satellite fails", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const satelliteClient = makeStubClient(async () => {
      throw new Error("satellite offline");
    });

    const runtime = await bootRuntime({
      stdin,
      stdout,
      mode: "satellite",
      satellite: {
        baseUrl: "http://unused.invalid",
        secret: "test-secret",
        fallback: true,
      },
      satelliteClient,
      providers: [new LocalFallbackProvider()],
    });

    const replyPromise = readOneLine(stdout);
    stdin.write("hi\n");
    const reply = await withTimeout(replyPromise, 500, "fallback reply");
    expect(reply).toBe("local:hi");

    const events = await runtime.memory.query("router", { limit: 50 });
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("router.out")).toBe(true);

    await withTimeout(runtime.shutdown(), 500, "runtime shutdown");
  });

  it("throws when satellite mode is selected without config or client", async () => {
    await expect(
      bootRuntime({
        mode: "satellite",
      }),
    ).rejects.toThrow(/satellite mode requires opts.satellite/);
  });
});
