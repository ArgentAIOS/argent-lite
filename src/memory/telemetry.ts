import type { Logger } from "../obs/types.js";
import type { Metrics } from "../obs/metrics.js";
import type { MemoryEvent, MemoryQueryOpts, MemoryStore } from "./types.js";

export interface MemoryTelemetryOptions {
  inner: MemoryStore;
  metrics: Metrics;
  logger?: Logger;
  now?: () => number;
}

const TOTAL = "memory.op.total";
const LATENCY = "memory.op.latency_ms";
const ERRORS = "memory.op.errors";

type Op = "get" | "set" | "list" | "append" | "query" | "close";

export function withTelemetry(opts: MemoryTelemetryOptions): MemoryStore {
  const { inner, metrics, logger } = opts;
  const now = opts.now ?? (() => Date.now());

  async function track<T>(op: Op, fn: () => Promise<T>): Promise<T> {
    const labels = { op };
    const start = now();
    metrics.inc(TOTAL, labels);
    try {
      const result = await fn();
      metrics.observe(LATENCY, now() - start, labels);
      return result;
    } catch (err) {
      metrics.observe(LATENCY, now() - start, labels);
      metrics.inc(ERRORS, labels);
      if (logger) {
        logger.error("memory.op.error", {
          op,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  }

  return {
    get(agentId: string, key: string): Promise<unknown> {
      return track("get", () => inner.get(agentId, key));
    },
    set(agentId: string, key: string, value: unknown): Promise<void> {
      return track("set", () => inner.set(agentId, key, value));
    },
    list(agentId: string): Promise<string[]> {
      return track("list", () => inner.list(agentId));
    },
    append(agentId: string, event: MemoryEvent): Promise<void> {
      return track("append", () => inner.append(agentId, event));
    },
    query(agentId: string, queryOpts?: MemoryQueryOpts): Promise<MemoryEvent[]> {
      return track("query", () => inner.query(agentId, queryOpts));
    },
    close(): Promise<void> {
      return track("close", () => inner.close());
    },
  };
}
