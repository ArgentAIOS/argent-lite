import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "./types.js";

export interface Metrics {
  inc(name: string, labels?: Record<string, string>, by?: number): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
}

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export interface InstrumentOptions {
  inner: Router;
  metrics?: Metrics;
  logger?: Logger;
  now?: () => number;
}

export function instrumentRouter(opts: InstrumentOptions): Router {
  const { inner, metrics, logger } = opts;
  const now = opts.now ?? (() => Date.now());

  return {
    register(provider: Provider): void {
      inner.register(provider);
    },
    async route(req: CompletionRequest): Promise<CompletionResponse> {
      metrics?.inc("router.route.total", { policy: "unknown" });
      const start = now();
      try {
        const res = await inner.route(req);
        const duration = now() - start;
        metrics?.observe("router.route.latency_ms", duration, { ok: "true" });
        metrics?.inc("router.route.success");
        logger?.info("router.route", {
          duration_ms: duration,
          ok: true,
          provider: res.providerId,
        });
        return res;
      } catch (err) {
        const duration = now() - start;
        metrics?.observe("router.route.latency_ms", duration, { ok: "false" });
        metrics?.inc("router.route.failure");
        const message = err instanceof Error ? err.message : String(err);
        logger?.error("router.route", {
          duration_ms: duration,
          ok: false,
          error: message,
        });
        throw err;
      }
    },
  };
}
