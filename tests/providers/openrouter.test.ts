import { describe, it, expect, vi } from "vitest";
import { OpenRouterProvider } from "../../src/providers/openrouter.js";

function makeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  });
}

describe("OpenRouterProvider", () => {
  it("POSTs to /api/v1/chat/completions with Referer + Title headers", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "or online" } }],
      model: "meta-llama/llama-3.1-8b-instruct",
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });

    const provider = new OpenRouterProvider({
      getKey: () => "test-key",
      fetchImpl,
    });
    const res = await provider.complete({ prompt: "hi", temperature: 0 });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const headers = init?.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer test-key");
    expect(headers["HTTP-Referer"]).toBe(
      "https://github.com/ArgentAIOS/argent-lite",
    );
    expect(headers["X-Title"]).toBe("Argent Lite");
    expect(res.text).toBe("or online");
    expect(res.providerId).toBe("openrouter");
  });

  it("respects injected referer + appTitle", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "x" } }],
      model: "m",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const provider = new OpenRouterProvider({
      getKey: () => "k",
      fetchImpl,
      referer: "https://example.com",
      appTitle: "My App",
    });
    await provider.complete({ prompt: "hi" });
    const headers = fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["HTTP-Referer"]).toBe("https://example.com");
    expect(headers["X-Title"]).toBe("My App");
  });

  it("returns empty text when content is null (reasoning-mode quirk)", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: null } }],
      model: "m",
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    });
    const provider = new OpenRouterProvider({
      getKey: () => "k",
      fetchImpl,
    });
    const res = await provider.complete({ prompt: "hi" });
    expect(res.text).toBe("");
  });

  it("throws on non-2xx", async () => {
    const fetchImpl = makeFetch({}, false, 402);
    const provider = new OpenRouterProvider({
      getKey: () => "k",
      fetchImpl,
    });
    await expect(provider.complete({ prompt: "hi" })).rejects.toThrow(
      /OpenRouterProvider: HTTP 402/,
    );
  });

  it("healthCheck true on non-empty key, false on empty", async () => {
    const a = new OpenRouterProvider({ getKey: () => "k" });
    const b = new OpenRouterProvider({ getKey: () => "" });
    expect(await a.healthCheck()).toBe(true);
    expect(await b.healthCheck()).toBe(false);
  });
});
