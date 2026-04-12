import { describe, it, expect } from "vitest";
import { withTelemetry } from "../../src/memory/telemetry.js";
import { createMetrics } from "../../src/obs/metrics.js";
import type {
  MemoryEvent,
  MemoryQueryOpts,
  MemoryStore,
} from "../../src/memory/types.js";
import type { LogRecord, Logger } from "../../src/obs/types.js";

interface FakeOptions {
  failOn?: Set<string>;
}

function fakeStore(options: FakeOptions = {}): MemoryStore & {
  closeCount: number;
} {
  const kv = new Map<string, unknown>();
  const events: MemoryEvent[] = [];
  const state = { closeCount: 0 };
  const fail = (op: string) => {
    if (options.failOn?.has(op)) {
      throw new Error(`boom:${op}`);
    }
  };
  return {
    get closeCount() {
      return state.closeCount;
    },
    async get(agentId: string, key: string): Promise<unknown> {
      fail("get");
      return kv.get(`${agentId}:${key}`);
    },
    async set(agentId: string, key: string, value: unknown): Promise<void> {
      fail("set");
      kv.set(`${agentId}:${key}`, value);
    },
    async list(agentId: string): Promise<string[]> {
      fail("list");
      const prefix = `${agentId}:`;
      return Array.from(kv.keys())
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
    },
    async append(_agentId: string, event: MemoryEvent): Promise<void> {
      fail("append");
      events.push(event);
    },
    async query(
      _agentId: string,
      _opts?: MemoryQueryOpts,
    ): Promise<MemoryEvent[]> {
      fail("query");
      return [...events];
    },
    async close(): Promise<void> {
      fail("close");
      state.closeCount += 1;
    },
  };
}

function recordingLogger(): { logger: Logger; records: LogRecord[] } {
  const records: LogRecord[] = [];
  const logger: Logger = {
    child() {
      return logger;
    },
    log(record: LogRecord): void {
      records.push(record);
    },
    debug(msg, fields) {
      records.push({ level: "debug", msg, ts: 0, fields });
    },
    info(msg, fields) {
      records.push({ level: "info", msg, ts: 0, fields });
    },
    warn(msg, fields) {
      records.push({ level: "warn", msg, ts: 0, fields });
    },
    error(msg, fields) {
      records.push({ level: "error", msg, ts: 0, fields });
    },
  };
  return { logger, records };
}

function counterFor(
  snapshot: ReturnType<ReturnType<typeof createMetrics>["snapshot"]>,
  name: string,
  op: string,
): number {
  const c = snapshot.counters.find(
    (s) => s.name === name && s.labels.op === op,
  );
  return c?.value ?? 0;
}

function histFor(
  snapshot: ReturnType<ReturnType<typeof createMetrics>["snapshot"]>,
  name: string,
  op: string,
): { count: number; sum: number } | undefined {
  const h = snapshot.histograms.find(
    (s) => s.name === name && s.labels.op === op,
  );
  return h ? { count: h.count, sum: h.sum } : undefined;
}

describe("withTelemetry", () => {
  it("records counters and latency for every op", async () => {
    const metrics = createMetrics();
    const inner = fakeStore();
    let t = 100;
    const store = withTelemetry({
      inner,
      metrics,
      now: () => {
        t += 5;
        return t;
      },
    });

    await store.set("a", "k", "v");
    await store.get("a", "k");
    await store.list("a");
    await store.append("a", { id: "e1", ts: 1, kind: "test", payload: null });
    await store.query("a");
    await store.close();

    const snap = metrics.snapshot();
    for (const op of ["get", "set", "list", "append", "query", "close"]) {
      expect(counterFor(snap, "memory.op.total", op)).toBe(1);
      const h = histFor(snap, "memory.op.latency_ms", op);
      expect(h?.count).toBe(1);
      expect(h?.sum).toBeGreaterThan(0);
      expect(counterFor(snap, "memory.op.errors", op)).toBe(0);
    }
  });

  it("propagates errors and increments error counter + logs", async () => {
    const metrics = createMetrics();
    const { logger, records } = recordingLogger();
    const inner = fakeStore({ failOn: new Set(["get"]) });
    const store = withTelemetry({ inner, metrics, logger });

    await expect(store.get("a", "k")).rejects.toThrow("boom:get");

    const snap = metrics.snapshot();
    expect(counterFor(snap, "memory.op.total", "get")).toBe(1);
    expect(counterFor(snap, "memory.op.errors", "get")).toBe(1);
    expect(histFor(snap, "memory.op.latency_ms", "get")?.count).toBe(1);

    const errorRecords = records.filter((r) => r.level === "error");
    expect(errorRecords).toHaveLength(1);
    expect(errorRecords[0]?.msg).toBe("memory.op.error");
    expect(errorRecords[0]?.fields?.op).toBe("get");
    expect(errorRecords[0]?.fields?.error).toBe("boom:get");
  });

  it("does not require a logger when inner throws", async () => {
    const metrics = createMetrics();
    const inner = fakeStore({ failOn: new Set(["set"]) });
    const store = withTelemetry({ inner, metrics });

    await expect(store.set("a", "k", 1)).rejects.toThrow("boom:set");
    const snap = metrics.snapshot();
    expect(counterFor(snap, "memory.op.errors", "set")).toBe(1);
  });

  it("close() increments and is idempotent across multiple calls", async () => {
    const metrics = createMetrics();
    const inner = fakeStore();
    const store = withTelemetry({ inner, metrics });

    await store.close();
    await store.close();
    await store.close();

    const snap = metrics.snapshot();
    expect(counterFor(snap, "memory.op.total", "close")).toBe(3);
    expect(histFor(snap, "memory.op.latency_ms", "close")?.count).toBe(3);
    expect(counterFor(snap, "memory.op.errors", "close")).toBe(0);
    expect(inner.closeCount).toBe(3);
  });
});
