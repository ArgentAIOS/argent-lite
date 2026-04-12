import { describe, it, expect, vi } from "vitest";
import { ZaiProvider } from "../../src/providers/zai.js";

function makeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  });
}

describe("ZaiProvider", () => {
  it("coder plan posts to the coding/paas/v4 endpoint", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "zai coder ok" } }],
      model: "glm-4.6",
      usage: { prompt_tokens: 12, completion_tokens: 91 },
    });

    const provider = new ZaiProvider({
      plan: "coder",
      getKey: () => "test-key",
      fetchImpl,
    });
    const res = await provider.complete({ prompt: "hi", temperature: 0 });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://api.z.ai/api/coding/paas/v4/chat/completions",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer test-key");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init?.body as string) as {
      model: string;
      max_tokens: number;
      temperature?: number;
    };
    expect(body.model).toBe("glm-4.6");
    expect(body.max_tokens).toBe(1024);
    expect(body.temperature).toBe(0);

    expect(res.text).toBe("zai coder ok");
    expect(res.providerId).toBe("zai-coder");
    expect(provider.plan).toBe("coder");
    expect(res.usage?.promptTokens).toBe(12);
    expect(res.usage?.completionTokens).toBe(91);
  });

  it("api plan posts to the paas/v4 endpoint", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "ok" } }],
      model: "glm-4.5",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const provider = new ZaiProvider({
      plan: "api",
      getKey: () => "k",
      fetchImpl,
      defaultModel: "glm-4.5",
    });
    await provider.complete({ prompt: "hi" });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(provider.id).toBe("zai-api");
    expect(provider.plan).toBe("api");
  });

  it("request maxTokens overrides the default", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "x" } }],
      model: "glm-4.6",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const provider = new ZaiProvider({
      plan: "coder",
      getKey: () => "k",
      fetchImpl,
    });
    await provider.complete({ prompt: "hi", maxTokens: 2048 });
    const body = JSON.parse(
      fetchImpl.mock.calls[0]![1]!.body as string,
    ) as { max_tokens: number };
    expect(body.max_tokens).toBe(2048);
  });

  it("throws on non-2xx with plan label", async () => {
    const fetchImpl = makeFetch({}, false, 429);
    const provider = new ZaiProvider({
      plan: "api",
      getKey: () => "k",
      fetchImpl,
    });
    await expect(provider.complete({ prompt: "hi" })).rejects.toThrow(
      /ZaiProvider\(api\): HTTP 429/,
    );
  });

  it("healthCheck: true on non-empty key, false on empty", async () => {
    const a = new ZaiProvider({ plan: "coder", getKey: () => "k" });
    const b = new ZaiProvider({ plan: "coder", getKey: () => "" });
    expect(await a.healthCheck()).toBe(true);
    expect(await b.healthCheck()).toBe(false);
  });
});
