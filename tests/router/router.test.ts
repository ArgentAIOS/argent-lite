import { describe, it, expect, vi } from "vitest";
import { ModelRouter } from "../../src/router/router.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../../src/router/types.js";

function mockProvider(
  id: string,
  kind: "local" | "cloud",
  impl: (req: CompletionRequest) => Promise<CompletionResponse>,
): Provider {
  return {
    id,
    kind,
    complete: vi.fn(impl),
    healthCheck: async () => true,
  };
}

function okResponse(id: string, text = "hello"): CompletionResponse {
  return { text, model: "m", providerId: id };
}

describe("ModelRouter", () => {
  it("throws when no providers registered", async () => {
    const router = new ModelRouter({ policy: "local-first" });
    await expect(router.route({ prompt: "hi" })).rejects.toThrow(
      /no providers/,
    );
  });

  it("local-first routes to the local provider", async () => {
    const cloud = mockProvider("anthropic", "cloud", async () =>
      okResponse("anthropic"),
    );
    const local = mockProvider("ollama", "local", async () =>
      okResponse("ollama"),
    );
    const router = new ModelRouter({ policy: "local-first" });
    router.register(cloud);
    router.register(local);

    const res = await router.route({ prompt: "hi" });
    expect(res.providerId).toBe("ollama");
    expect(cloud.complete).not.toHaveBeenCalled();
    expect(local.complete).toHaveBeenCalledTimes(1);
  });

  it("cloud-first routes to the cloud provider", async () => {
    const cloud = mockProvider("anthropic", "cloud", async () =>
      okResponse("anthropic"),
    );
    const local = mockProvider("ollama", "local", async () =>
      okResponse("ollama"),
    );
    const router = new ModelRouter({ policy: "cloud-first" });
    router.register(local);
    router.register(cloud);

    const res = await router.route({ prompt: "hi" });
    expect(res.providerId).toBe("anthropic");
  });

  it("falls back to the next provider on failure", async () => {
    const failing = mockProvider("ollama", "local", async () => {
      throw new Error("boom");
    });
    const healthy = mockProvider("anthropic", "cloud", async () =>
      okResponse("anthropic"),
    );
    const router = new ModelRouter({ policy: "local-first" });
    router.register(failing);
    router.register(healthy);

    const res = await router.route({ prompt: "hi" });
    expect(res.providerId).toBe("anthropic");
    expect(failing.complete).toHaveBeenCalledTimes(1);
    expect(healthy.complete).toHaveBeenCalledTimes(1);
  });

  it("rethrows when every provider fails", async () => {
    const a = mockProvider("ollama", "local", async () => {
      throw new Error("boom-a");
    });
    const b = mockProvider("anthropic", "cloud", async () => {
      throw new Error("boom-b");
    });
    const router = new ModelRouter({ policy: "local-first" });
    router.register(a);
    router.register(b);

    await expect(router.route({ prompt: "hi" })).rejects.toThrow(
      /all providers failed/,
    );
  });

  it("retry budget caps the number of attempts", async () => {
    const a = mockProvider("a", "local", async () => {
      throw new Error("boom-a");
    });
    const b = mockProvider("b", "cloud", async () => {
      throw new Error("boom-b");
    });
    const c = mockProvider("c", "cloud", async () => okResponse("c"));

    const router = new ModelRouter({ policy: "local-first", retryBudget: 0 });
    router.register(a);
    router.register(b);
    router.register(c);

    await expect(router.route({ prompt: "hi" })).rejects.toThrow(/boom-a/);
    expect(a.complete).toHaveBeenCalledTimes(1);
    expect(b.complete).not.toHaveBeenCalled();
    expect(c.complete).not.toHaveBeenCalled();
  });
});
