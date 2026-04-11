import type { MemoryStore } from "../memory/types.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "./types.js";

export interface MemoryRouterLogger {
  error(msg: string, fields?: Record<string, unknown>): void;
}

export interface MemoryRouterOptions {
  inner: Router;
  memory: MemoryStore;
  agentId?: string;
  now?: () => number;
  logger?: MemoryRouterLogger;
  idGen?: () => string;
}

export function withMemoryLog(opts: MemoryRouterOptions): Router {
  const { inner, memory, logger } = opts;
  const agentId = opts.agentId ?? "router";
  const now = opts.now ?? (() => Date.now());
  let counter = 0;
  const idGen =
    opts.idGen ??
    (() => `router-${now()}-${(counter++).toString(36)}`);

  const safeAppend = async (
    kind: string,
    payload: unknown,
  ): Promise<void> => {
    try {
      await memory.append(agentId, { id: idGen(), ts: now(), kind, payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger?.error("memory-router.append", { kind, error: message });
    }
  };

  return {
    register(provider: Provider): void {
      inner.register(provider);
    },
    async route(req: CompletionRequest): Promise<CompletionResponse> {
      try {
        const res = await inner.route(req);
        await safeAppend("router.out", {
          req,
          providerId: res.providerId,
          model: res.model,
        });
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await safeAppend("agent.error", { req, error: message });
        throw err;
      }
    },
  };
}
