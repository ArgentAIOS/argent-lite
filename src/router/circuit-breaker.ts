import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "./types.js";

export interface CircuitBreakerOptions {
  inner: Router;
  threshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class CircuitOpenError extends Error {
  readonly providerId: string;

  constructor(providerId: string) {
    super(`circuit open for provider: ${providerId}`);
    this.name = "CircuitOpenError";
    this.providerId = providerId;
  }
}

type CircuitState =
  | { status: "closed"; failures: number }
  | { status: "open"; openedAt: number }
  | { status: "half-open" };

class CircuitBreakerRouter implements Router {
  private readonly inner: Router;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly states = new Map<string, CircuitState>();

  constructor(opts: CircuitBreakerOptions) {
    const threshold = opts.threshold ?? 5;
    const cooldownMs = opts.cooldownMs ?? 30000;
    if (threshold <= 0) {
      throw new Error("withCircuitBreaker: threshold must be > 0");
    }
    if (cooldownMs <= 0) {
      throw new Error("withCircuitBreaker: cooldownMs must be > 0");
    }
    this.inner = opts.inner;
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.now = opts.now ?? (() => Date.now());
  }

  register(provider: Provider): void {
    this.states.set(provider.id, { status: "closed", failures: 0 });
    this.inner.register(this.wrap(provider));
  }

  async route(req: CompletionRequest): Promise<CompletionResponse> {
    return this.inner.route(req);
  }

  private wrap(provider: Provider): Provider {
    const gate = (): boolean => this.checkGate(provider.id);
    const onSuccess = (): void => this.onSuccess(provider.id);
    const onFailure = (): void => this.onFailure(provider.id);
    return {
      id: provider.id,
      kind: provider.kind,
      healthCheck: () => provider.healthCheck(),
      complete: async (req) => {
        if (!gate()) {
          throw new CircuitOpenError(provider.id);
        }
        try {
          const res = await provider.complete(req);
          onSuccess();
          return res;
        } catch (err) {
          onFailure();
          throw err;
        }
      },
    };
  }

  private checkGate(id: string): boolean {
    const state = this.states.get(id);
    if (!state) return true;
    if (state.status === "closed" || state.status === "half-open") {
      return true;
    }
    if (this.now() - state.openedAt >= this.cooldownMs) {
      this.states.set(id, { status: "half-open" });
      return true;
    }
    return false;
  }

  private onSuccess(id: string): void {
    this.states.set(id, { status: "closed", failures: 0 });
  }

  private onFailure(id: string): void {
    const state = this.states.get(id);
    if (!state || state.status !== "closed") {
      this.states.set(id, { status: "open", openedAt: this.now() });
      return;
    }
    const failures = state.failures + 1;
    if (failures >= this.threshold) {
      this.states.set(id, { status: "open", openedAt: this.now() });
    } else {
      this.states.set(id, { status: "closed", failures });
    }
  }
}

export function withCircuitBreaker(opts: CircuitBreakerOptions): Router {
  return new CircuitBreakerRouter(opts);
}
