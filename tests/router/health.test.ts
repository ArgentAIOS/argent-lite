import { describe, it, expect } from "vitest";
import { routerHealth } from "../../src/router/health.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../../src/router/types.js";

class MockProvider implements Provider {
  readonly kind = "local" as const;
  constructor(
    readonly id: string,
    private readonly healthy: boolean,
    private readonly shouldThrow = false,
  ) {}
  async complete(_req: CompletionRequest): Promise<CompletionResponse> {
    return { text: "", model: "", providerId: this.id };
  }
  async healthCheck(): Promise<boolean> {
    if (this.shouldThrow) throw new Error("boom");
    return this.healthy;
  }
}

describe("routerHealth", () => {
  it("reports healthy + unhealthy providers with measured latency", async () => {
    const providers: Provider[] = [
      new MockProvider("alpha", true),
      new MockProvider("beta", false),
    ];
    const registry = { list: () => providers };

    let t = 1000;
    const clock = () => {
      const now = t;
      t += 5;
      return now;
    };

    const result = await routerHealth(registry, clock);
    expect(result).toHaveLength(2);

    const alpha = result.find((r) => r.providerId === "alpha");
    const beta = result.find((r) => r.providerId === "beta");
    expect(alpha?.healthy).toBe(true);
    expect(beta?.healthy).toBe(false);
    expect(alpha?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(beta?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("treats a throwing healthCheck as unhealthy", async () => {
    const providers: Provider[] = [new MockProvider("boom", false, true)];
    const registry = { list: () => providers };
    const result = await routerHealth(registry);
    expect(result).toEqual([
      { providerId: "boom", healthy: false, latencyMs: expect.any(Number) },
    ]);
  });

  it("returns empty array when no providers are registered", async () => {
    const result = await routerHealth({ list: () => [] });
    expect(result).toEqual([]);
  });
});
