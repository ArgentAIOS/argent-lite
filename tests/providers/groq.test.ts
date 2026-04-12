import { describe, it, expect, vi } from "vitest";
import { GroqProvider } from "../../src/providers/groq.js";

function makeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  });
}

describe("GroqProvider", () => {
  it("POSTs to /openai/v1/chat/completions with bearer auth", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "hello from groq" } }],
      model: "llama-3.1-8b-instant",
      usage: { prompt_tokens: 5, completion_tokens: 4 },
    });

    const provider = new GroqProvider({
      getKey: () => "test-key",
      fetchImpl,
    });
    const res = await provider.complete({ prompt: "hi", temperature: 0 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer test-key");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init?.body as string) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
    };
    expect(body.model).toBe("llama-3.1-8b-instant");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.temperature).toBe(0);

    expect(res.text).toBe("hello from groq");
    expect(res.providerId).toBe("groq");
    expect(res.model).toBe("llama-3.1-8b-instant");
    expect(res.usage?.promptTokens).toBe(5);
    expect(res.usage?.completionTokens).toBe(4);
  });

  it("respects an injected defaultModel and id", async () => {
    const fetchImpl = makeFetch({
      choices: [{ message: { content: "ok" } }],
      model: "llama-3.3-70b-versatile",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const provider = new GroqProvider({
      id: "groq-70b",
      defaultModel: "llama-3.3-70b-versatile",
      getKey: async () => "k",
      fetchImpl,
    });
    const res = await provider.complete({ prompt: "hi" });

    const body = JSON.parse(
      fetchImpl.mock.calls[0]![1]!.body as string,
    ) as { model: string };
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(res.providerId).toBe("groq-70b");
  });

  it("throws on non-2xx status", async () => {
    const fetchImpl = makeFetch({}, false, 401);
    const provider = new GroqProvider({
      getKey: () => "bad",
      fetchImpl,
    });
    await expect(provider.complete({ prompt: "hi" })).rejects.toThrow(
      /GroqProvider: HTTP 401/,
    );
  });

  it("healthCheck returns true when a non-empty key resolves", async () => {
    const provider = new GroqProvider({ getKey: () => "k" });
    expect(await provider.healthCheck()).toBe(true);
  });

  it("healthCheck returns false when getKey throws", async () => {
    const provider = new GroqProvider({
      getKey: () => {
        throw new Error("no key");
      },
    });
    expect(await provider.healthCheck()).toBe(false);
  });

  it("healthCheck returns false on empty key", async () => {
    const provider = new GroqProvider({ getKey: () => "" });
    expect(await provider.healthCheck()).toBe(false);
  });
});
