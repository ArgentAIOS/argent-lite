import { describe, it, expect, vi } from "vitest";
import { instrumentedMain } from "../../src/cli/instrumented-main.js";
import { createLogger } from "../../src/obs/logger.js";
import { createMetrics } from "../../src/obs/metrics.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";
import type { LogRecord } from "../../src/obs/types.js";

function captureLogger(records: LogRecord[]) {
  const out: NodeJS.WritableStream = {
    write(chunk: string | Uint8Array): boolean {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      for (const line of text.split("\n")) {
        if (!line) continue;
        records.push(JSON.parse(line) as LogRecord);
      }
      return true;
    },
  } as NodeJS.WritableStream;
  return createLogger({ level: "debug", out });
}

function fakeRouter(response: CompletionResponse): Router {
  return {
    route: vi.fn(async (_req: CompletionRequest) => response),
    register: vi.fn((_p: Provider) => {}),
  };
}

function fakeStream(): NodeJS.WritableStream & { data: string } {
  const s = {
    data: "",
    write(chunk: string | Uint8Array): boolean {
      s.data += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    },
  };
  return s as unknown as NodeJS.WritableStream & { data: string };
}

describe("instrumentedMain", () => {
  it("routes a prompt and records metrics + logs", async () => {
    const records: LogRecord[] = [];
    const logger = captureLogger(records);
    const metrics = createMetrics();
    const stdout = fakeStream();
    const stderr = fakeStream();

    const response: CompletionResponse = {
      text: "hello-world",
      model: "mock",
      providerId: "mock-provider",
    };
    const router = fakeRouter(response);

    const code = await instrumentedMain(["say", "hi"], {
      routerOverride: router,
      logger,
      metrics,
      stdout,
      stderr,
    });

    expect(code).toBe(0);
    expect(stdout.data).toBe("hello-world\n");
    expect(stderr.data).toBe("");

    const routeLog = records.find((r) => r.msg === "router.route");
    expect(routeLog).toBeDefined();
    expect(routeLog?.fields?.ok).toBe(true);
    expect(routeLog?.fields?.provider).toBe("mock-provider");

    const snap = metrics.snapshot();
    const success = snap.counters.find(
      (c) => c.name === "router.route.success",
    );
    expect(success?.value).toBe(1);

    const summaryLog = records.find(
      (r) => r.msg === "instrumented-main.summary",
    );
    expect(summaryLog).toBeDefined();
    expect(summaryLog?.fields?.success).toBe(1);
    expect(summaryLog?.fields?.exit_code).toBe(0);
  });

  it("returns 2 on empty prompt", async () => {
    const logger = captureLogger([]);
    const metrics = createMetrics();
    const stdout = fakeStream();
    const stderr = fakeStream();

    const code = await instrumentedMain([], {
      routerOverride: fakeRouter({
        text: "unused",
        model: "m",
        providerId: "p",
      }),
      logger,
      metrics,
      stdout,
      stderr,
    });

    expect(code).toBe(2);
    expect(stderr.data).toContain("usage:");
  });

  it("returns 3 on router failure and records failure counter", async () => {
    const records: LogRecord[] = [];
    const logger = captureLogger(records);
    const metrics = createMetrics();
    const stdout = fakeStream();
    const stderr = fakeStream();

    const router: Router = {
      register: vi.fn(),
      route: vi.fn(async () => {
        throw new Error("boom");
      }),
    };

    const code = await instrumentedMain(["hi"], {
      routerOverride: router,
      logger,
      metrics,
      stdout,
      stderr,
    });

    expect(code).toBe(3);
    expect(stderr.data).toContain("boom");

    const failure = metrics
      .snapshot()
      .counters.find((c) => c.name === "router.route.failure");
    expect(failure?.value).toBe(1);

    const summaryLog = records.find(
      (r) => r.msg === "instrumented-main.summary",
    );
    expect(summaryLog?.fields?.exit_code).toBe(3);
  });
});
