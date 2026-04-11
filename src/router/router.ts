import { selectProviders } from "./policy.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  RouteHints,
  RoutePolicy,
  Router,
} from "./types.js";

export interface ModelRouterOptions {
  policy: RoutePolicy;
  retryBudget?: number;
  hints?: RouteHints;
}

export class ModelRouter implements Router {
  private readonly providers: Map<string, Provider> = new Map();
  private readonly policy: RoutePolicy;
  private readonly retryBudget: number;
  private readonly hints: RouteHints;

  constructor(opts: ModelRouterOptions) {
    this.policy = opts.policy;
    this.retryBudget = opts.retryBudget ?? 2;
    this.hints = opts.hints ?? {};
  }

  register(provider: Provider): void {
    this.providers.set(provider.id, provider);
  }

  list(): Provider[] {
    return [...this.providers.values()];
  }

  async route(req: CompletionRequest): Promise<CompletionResponse> {
    const ordered = selectProviders(this.list(), this.policy, this.hints);
    if (ordered.length === 0) {
      throw new Error("ModelRouter: no providers registered");
    }

    const maxAttempts = Math.min(ordered.length, this.retryBudget + 1);
    const errors: Error[] = [];

    for (let i = 0; i < maxAttempts; i++) {
      const provider = ordered[i];
      if (!provider) break;
      try {
        return await provider.complete(req);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    const detail = errors.map((e) => e.message).join("; ");
    throw new Error(`ModelRouter: all providers failed: ${detail}`);
  }
}
