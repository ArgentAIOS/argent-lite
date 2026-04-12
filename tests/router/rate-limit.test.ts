import { describe, it, expect, vi } from "vitest";
import {
  withRateLimit,
  RateLimitedError,
} from "../../src/router/rate-limit.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";

function stubResponse(): CompletionResponse {
  return { text: "ok", model: "m", providerId: "stub" };
}

function stubRouter(): Router & {
  routeCalls: number;
  registered: Provider[];
} {
  const state = { routeCalls: 0, registered: [] as Provider[] };
  return {
    get routeCalls() {
      return state.routeCalls;
    },
    get registered() {
      return state.registered;
    },
    async route(_req: CompletionRequest): Promise<CompletionResponse> {
      state.routeCalls += 1;
      return stubResponse();
    },
    register(p: Provider): void {
      state.registered.push(p);
    },
  };
}

describe("withRateLimit", () => {
  it("allows a full burst then throws on the next call", async () => {
    const inner = stubRouter();
    let t = 1_000;
    const limited = withRateLimit({
      inner,
      tokensPerSec: 1,
      burst: 3,
      now: () => t,
    });

    await limited.route({ prompt: "a" });
    await limited.route({ prompt: "b" });
    await limited.route({ prompt: "c" });
    await expect(limited.route({ prompt: "d" })).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    expect(inner.routeCalls).toBe(3);
  });

  it("refills one token after 1/tokensPerSec ms", async () => {
    const inner = stubRouter();
    let t = 0;
    const limited = withRateLimit({
      inner,
      tokensPerSec: 2,
      burst: 1,
      now: () => t,
    });

    await limited.route({ prompt: "a" });
    await expect(limited.route({ prompt: "b" })).rejects.toBeInstanceOf(
      RateLimitedError,
    );

    t += 500; // 1000 / 2
    await limited.route({ prompt: "c" });
    expect(inner.routeCalls).toBe(2);
  });

  it("sustained calls at the exact refill rate never throw", async () => {
    const inner = stubRouter();
    let t = 0;
    const limited = withRateLimit({
      inner,
      tokensPerSec: 10,
      burst: 1,
      now: () => t,
    });

    for (let i = 0; i < 50; i++) {
      await limited.route({ prompt: `p${i}` });
      t += 100; // 1000 / 10
    }
    expect(inner.routeCalls).toBe(50);
  });

  it("retryAfterMs is non-negative and decreases as time advances", async () => {
    const inner = stubRouter();
    let t = 0;
    const limited = withRateLimit({
      inner,
      tokensPerSec: 1,
      burst: 1,
      now: () => t,
    });

    await limited.route({ prompt: "a" });

    const first = await limited.route({ prompt: "b" }).catch((e) => e);
    expect(first).toBeInstanceOf(RateLimitedError);
    const firstRetry = (first as RateLimitedError).retryAfterMs;
    expect(firstRetry).toBeGreaterThanOrEqual(0);

    t += 250;
    const second = await limited.route({ prompt: "c" }).catch((e) => e);
    expect(second).toBeInstanceOf(RateLimitedError);
    const secondRetry = (second as RateLimitedError).retryAfterMs;
    expect(secondRetry).toBeGreaterThanOrEqual(0);
    expect(secondRetry).toBeLessThan(firstRetry);

    t += 1_000;
    await limited.route({ prompt: "d" });
    expect(inner.routeCalls).toBe(2);
  });

  it("register() delegates to the inner router untouched", async () => {
    const inner = stubRouter();
    const limited = withRateLimit({
      inner,
      tokensPerSec: 1,
      burst: 1,
    });
    const provider: Provider = {
      id: "p",
      kind: "local",
      complete: vi.fn(async () => stubResponse()),
      healthCheck: async () => true,
    };
    limited.register(provider);
    expect(inner.registered).toEqual([provider]);
  });
});
