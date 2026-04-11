import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { StubProvider } from "./stub-provider.js";
import type { Provider } from "../../src/router/types.js";
import type { MemoryEvent, MemoryStore } from "../../src/memory/types.js";

interface BootRuntimeOpts {
  providers: Provider[];
  memoryPath: string;
  now?: () => number;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

interface Runtime {
  shutdown(): Promise<void>;
  memory: MemoryStore;
}

type BootRuntimeFn = (opts: BootRuntimeOpts) => Promise<Runtime>;

interface RuntimeModule {
  bootRuntime?: BootRuntimeFn;
}

async function loadBootRuntime(): Promise<BootRuntimeFn | null> {
  try {
    // Indirect specifier so TS does not try to statically resolve the
    // module — the runtime seam may not be merged yet on this branch.
    const specifier = "../../src/integration/runtime.js";
    const dynamicImport = new Function(
      "s",
      "return import(s);",
    ) as (s: string) => Promise<unknown>;
    const mod = (await dynamicImport(specifier)) as RuntimeModule;
    return typeof mod.bootRuntime === "function" ? mod.bootRuntime : null;
  } catch {
    return null;
  }
}

function getActiveHandleCount(): number {
  const proc = process as NodeJS.Process & {
    _getActiveHandles?: () => unknown[];
  };
  return proc._getActiveHandles ? proc._getActiveHandles().length : 0;
}

function readFirstLine(stream: PassThrough, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      stream.off("data", onData);
      reject(new Error(`timeout waiting for stdout line after ${timeoutMs}ms`));
    }, timeoutMs);
    const onData = (chunk: Buffer | string): void => {
      buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        stream.off("data", onData);
        resolve(buf.slice(0, nl));
      }
    };
    stream.on("data", onData);
  });
}

describe("cli-chat integration", () => {
  it("routes a prompt through the stub provider and writes locked event kinds", async (ctx) => {
    const bootRuntime = await loadBootRuntime();
    if (!bootRuntime) {
      console.warn(
        "[cli-chat] src/integration/runtime.ts#bootRuntime not found — skipping (seam not merged yet)",
      );
      ctx.skip();
      return;
    }

    const baselineHandles = getActiveHandleCount();
    const dir = await mkdtemp(join(tmpdir(), "argent-cli-chat-"));
    const memoryPath = join(dir, "memory.sqlite");
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    let nowCounter = 1_700_000_000_000;
    const now = (): number => nowCounter++;

    const runtime = await bootRuntime({
      providers: [new StubProvider()],
      memoryPath,
      now,
      stdin,
      stdout,
    });

    try {
      stdin.write("hello\n");
      const line = await readFirstLine(stdout, 5_000);
      expect(line.startsWith("stub reply:")).toBe(true);

      const events: MemoryEvent[] = await runtime.memory.query("channel");
      const kinds = new Set(events.map((e) => e.kind));
      expect(kinds.has("channel.in")).toBe(true);
      expect(kinds.has("router.out")).toBe(true);

      const lockedKinds = new Set([
        "channel.in",
        "channel.out",
        "router.in",
        "router.out",
        "agent.error",
      ]);
      for (const kind of kinds) {
        expect(lockedKinds.has(kind)).toBe(true);
      }
    } finally {
      const shutdownStart = Date.now();
      await Promise.race([
        runtime.shutdown(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("runtime.shutdown() exceeded 500ms")),
            500,
          ),
        ),
      ]);
      expect(Date.now() - shutdownStart).toBeLessThanOrEqual(500);
      await rm(dir, { recursive: true, force: true });
    }

    expect(getActiveHandleCount()).toBeLessThanOrEqual(baselineHandles);
  });
});
