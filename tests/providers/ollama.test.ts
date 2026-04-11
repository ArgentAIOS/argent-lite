import { describe, it, expect, vi } from "vitest";
import { OllamaProvider } from "../../src/providers/ollama.js";

function makeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  });
}

describe("OllamaProvider", () => {
  it("POSTs to /api/generate with the request body", async () => {
    const fetchImpl = makeFetch({
      response: "hello world",
      model: "gemma3:1b",
      prompt_eval_count: 3,
      eval_count: 5,
    });

    const provider = new OllamaProvider({ fetchImpl });
    const res = await provider.complete({
      prompt: "hi",
      temperature: 0.2,
      maxTokens: 32,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:11434/api/generate");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      model: "gemma3:1b",
      prompt: "hi",
      stream: false,
      options: { temperature: 0.2, num_predict: 32 },
    });
    expect(res.text).toBe("hello world");
    expect(res.providerId).toBe("ollama");
    expect(res.usage).toEqual({ promptTokens: 3, completionTokens: 5 });
  });

  it("uses default model when req.model is absent", async () => {
    const fetchImpl = makeFetch({ response: "ok", model: "gemma3:1b" });
    const provider = new OllamaProvider({ fetchImpl });
    await provider.complete({ prompt: "hi" });
    const init = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("gemma3:1b");
    expect(body.options).toBeUndefined();
  });

  it("respects a custom baseUrl", async () => {
    const fetchImpl = makeFetch({ response: "ok" });
    const provider = new OllamaProvider({
      fetchImpl,
      baseUrl: "http://pi5.local:11434",
    });
    await provider.complete({ prompt: "hi" });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://pi5.local:11434/api/generate",
    );
  });

  it("throws on non-ok responses", async () => {
    const fetchImpl = makeFetch({}, false, 500);
    const provider = new OllamaProvider({ fetchImpl });
    await expect(provider.complete({ prompt: "hi" })).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("healthCheck returns true on ok /api/tags", async () => {
    const fetchImpl = makeFetch({ models: [] });
    const provider = new OllamaProvider({ fetchImpl });
    expect(await provider.healthCheck()).toBe(true);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:11434/api/tags");
  });

  it("healthCheck returns false when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const provider = new OllamaProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await provider.healthCheck()).toBe(false);
  });
});
