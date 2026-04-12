import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { bootRuntime } from "../../src/integration/runtime.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../../src/router/types.js";

class StubProvider implements Provider {
  readonly id = "stub";
  readonly kind = "local" as const;
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    return {
      text: `echo:${req.prompt}`,
      model: "stub-model",
      providerId: this.id,
    };
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }
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

function activeHandleCount(): number {
  const proc = process as unknown as {
    _getActiveHandles?: () => unknown[];
  };
  return typeof proc._getActiveHandles === "function"
    ? proc._getActiveHandles().length
    : 0;
}

describe("bootRuntime", () => {
  it("delivers a prompt to the router agent and logs both sides to memory", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();

    const runtime = await bootRuntime({
      stdin,
      stdout,
      providers: [new StubProvider()],
    });

    const replyPromise = readOneLine(stdout);
    stdin.write("hello\n");
    const reply = await withTimeout(replyPromise, 500, "router reply");
    expect(reply).toBe("echo:hello");

    const events = await runtime.memory.query("router", { limit: 50 });
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("channel.in")).toBe(true);
    expect(kinds.has("channel.out")).toBe(true);

    const handlesBefore = activeHandleCount();

    await withTimeout(runtime.shutdown(), 500, "runtime shutdown");
    // shutdown is idempotent
    await withTimeout(runtime.shutdown(), 500, "runtime shutdown (2nd)");

    const handlesAfter = activeHandleCount();
    expect(handlesAfter).toBeLessThanOrEqual(handlesBefore);
  });
});
