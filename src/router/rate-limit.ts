import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "./types.js";

export interface RateLimitOptions {
  inner: Router;
  tokensPerSec: number;
  burst: number;
  now?: () => number;
}

export class RateLimitedError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`rate limited: retry after ${retryAfterMs}ms`);
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

class TokenBucketRouter implements Router {
  private readonly inner: Router;
  private readonly tokensPerSec: number;
  private readonly burst: number;
  private readonly now: () => number;
  private tokens: number;
  private lastRefillMs: number;

  constructor(opts: RateLimitOptions) {
    if (opts.tokensPerSec <= 0) {
      throw new Error("withRateLimit: tokensPerSec must be > 0");
    }
    if (opts.burst <= 0) {
      throw new Error("withRateLimit: burst must be > 0");
    }
    this.inner = opts.inner;
    this.tokensPerSec = opts.tokensPerSec;
    this.burst = opts.burst;
    this.now = opts.now ?? (() => Date.now());
    this.tokens = opts.burst;
    this.lastRefillMs = this.now();
  }

  register(provider: Provider): void {
    this.inner.register(provider);
  }

  async route(req: CompletionRequest): Promise<CompletionResponse> {
    this.refill();
    if (this.tokens < 1) {
      const deficit = 1 - this.tokens;
      const retryAfterMs = Math.ceil((deficit / this.tokensPerSec) * 1000);
      throw new RateLimitedError(retryAfterMs);
    }
    this.tokens -= 1;
    return this.inner.route(req);
  }

  private refill(): void {
    const nowMs = this.now();
    const elapsedMs = nowMs - this.lastRefillMs;
    if (elapsedMs <= 0) return;
    const added = (elapsedMs / 1000) * this.tokensPerSec;
    this.tokens = Math.min(this.burst, this.tokens + added);
    this.lastRefillMs = nowMs;
  }
}

export function withRateLimit(opts: RateLimitOptions): Router {
  return new TokenBucketRouter(opts);
}
