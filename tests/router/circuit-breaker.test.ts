import { describe, it, expect } from "vitest";
import {
  withCircuitBreaker,
  CircuitOpenError,
} from "../../src/router/circuit-breaker.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/types.js";

class FakeInner implements Router {
  readonly registered: Provider[] = [];

  register(provider: Provider): void {
    this.registered.push(provider);
  }

  async route(req: CompletionRequest): Promise<CompletionResponse> {
    const errors: Error[] = [];
    for (const p of this.registered) {
      try {
        return await p.complete(req);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    throw new Error(
      `FakeInner: all providers failed: ${errors.map((e) => e.message).join("; ")}`,
    );
  }
}

interface FakeProvider extends Provider {
  calls: number;
}

function makeProvider(id: string, sequence: Array<"ok" | "fail">): FakeProvider {
  const p: FakeProvider = {
    id,
    kind: "cloud",
    calls: 0,
    async complete(_req: CompletionRequest): Promise<CompletionResponse> {
      const idx = p.calls++;
      const outcome =
        sequence[Math.min(idx, sequence.length - 1)] ?? "ok";
      if (outcome === "fail") {
        throw new Error(`${id} fail #${idx}`);
      }
      return { text: "ok", model: "m", providerId: id };
    },
    async healthCheck() {
      return true;
    },
  };
  return p;
}

describe("withCircuitBreaker", () => {
  it("opens after threshold failures and skips further calls", async () => {
    const inner = new FakeInner();
    const breaker = withCircuitBreaker({
      inner,
      threshold: 5,
      cooldownMs: 30_000,
      now: () => 0,
    });
    const p = makeProvider("p1", ["fail"]);
    breaker.register(p);

    for (let i = 0; i < 5; i++) {
      await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    }
    expect(p.calls).toBe(5);

    // 6th call: circuit is open, provider should be skipped.
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    expect(p.calls).toBe(5);
  });

  it("surfaces CircuitOpenError when the open provider is the only one", async () => {
    const inner = new FakeInner();
    const breaker = withCircuitBreaker({
      inner,
      threshold: 2,
      cooldownMs: 1_000,
      now: () => 0,
    });
    const p = makeProvider("p1", ["fail"]);
    breaker.register(p);

    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();

    let caught: unknown;
    try {
      await breaker.route({ prompt: "x" });
    } catch (err) {
      caught = err;
    }
    const msg = caught instanceof Error ? caught.message : "";
    expect(msg).toContain("circuit open for provider: p1");
  });

  it("half-opens after cooldown and closes on success", async () => {
    const inner = new FakeInner();
    let t = 0;
    const breaker = withCircuitBreaker({
      inner,
      threshold: 2,
      cooldownMs: 1_000,
      now: () => t,
    });
    const p = makeProvider("p1", ["fail", "fail", "ok", "ok"]);
    breaker.register(p);

    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    expect(p.calls).toBe(2);

    // Still inside cooldown — provider not called.
    t = 500;
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    expect(p.calls).toBe(2);

    // Past cooldown → half-open, one probe goes through and succeeds.
    t = 2_000;
    const res = await breaker.route({ prompt: "x" });
    expect(res.providerId).toBe("p1");
    expect(p.calls).toBe(3);

    // Circuit should be closed again; failures reset.
    const res2 = await breaker.route({ prompt: "x" });
    expect(res2.providerId).toBe("p1");
    expect(p.calls).toBe(4);
  });

  it("re-opens when the half-open probe fails", async () => {
    const inner = new FakeInner();
    let t = 0;
    const breaker = withCircuitBreaker({
      inner,
      threshold: 2,
      cooldownMs: 1_000,
      now: () => t,
    });
    const p = makeProvider("p1", ["fail", "fail", "fail", "ok"]);
    breaker.register(p);

    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    expect(p.calls).toBe(2);

    // Past cooldown — half-open probe goes through but fails.
    t = 2_000;
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    expect(p.calls).toBe(3);

    // Circuit re-opened; next call within new cooldown is skipped.
    t = 2_500;
    await expect(breaker.route({ prompt: "x" })).rejects.toThrow();
    expect(p.calls).toBe(3);
  });

  it("allows policy to fall through to a healthy provider when another circuit is open", async () => {
    const inner = new FakeInner();
    const breaker = withCircuitBreaker({
      inner,
      threshold: 2,
      cooldownMs: 10_000,
      now: () => 0,
    });
    const p1 = makeProvider("p1", ["fail"]);
    const p2 = makeProvider("p2", ["ok"]);
    breaker.register(p1);
    breaker.register(p2);

    // First two calls: p1 fails, FakeInner falls through to p2.
    const r1 = await breaker.route({ prompt: "x" });
    expect(r1.providerId).toBe("p2");
    const r2 = await breaker.route({ prompt: "x" });
    expect(r2.providerId).toBe("p2");
    expect(p1.calls).toBe(2);

    // p1 circuit now open; p1 should be skipped, p2 still serves.
    const r3 = await breaker.route({ prompt: "x" });
    expect(r3.providerId).toBe("p2");
    expect(p1.calls).toBe(2);
    expect(p2.calls).toBe(3);
  });

  it("does not mutate the inner router when registering wrapped providers", () => {
    const inner = new FakeInner();
    const breaker = withCircuitBreaker({
      inner,
      threshold: 3,
      cooldownMs: 1_000,
      now: () => 0,
    });
    const p = makeProvider("p1", ["ok"]);
    breaker.register(p);

    // The wrapped provider stored in the inner router is NOT the original.
    expect(inner.registered.length).toBe(1);
    expect(inner.registered[0]).not.toBe(p);
    expect(inner.registered[0]?.id).toBe("p1");
  });

  it("exports CircuitOpenError with providerId", () => {
    const err = new CircuitOpenError("foo");
    expect(err.providerId).toBe("foo");
    expect(err.name).toBe("CircuitOpenError");
  });
});
