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

describe("bootRuntime", () => {
  it("wires channel → router → memory and shuts down cleanly", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();

    const runtime = await bootRuntime({
      stdin,
      stdout,
      providers: [new StubProvider()],
    });

    const replyPromise = readOneLine(stdout);
    stdin.write("hello\n");
    const reply = await replyPromise;

    expect(reply).toBe("echo:hello");

    const events = await runtime.memory.query("router", { limit: 50 });
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("channel.in")).toBe(true);
    expect(kinds.has("channel.out")).toBe(true);
    expect(kinds.has("router.route")).toBe(true);

    await runtime.shutdown();
    await runtime.shutdown();
  });
});
