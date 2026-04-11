import { describe, expect, it, vi } from "vitest";
import { createDefaultRouter } from "../../src/router/default-router.js";
import type { CredentialStore } from "../../src/auth/types.js";

function fakeCredentialStore(
  entries: Record<string, string> = {},
): CredentialStore {
  const store = new Map(Object.entries(entries));
  return {
    get: async (id) => store.get(id),
    set: async (id, secret) => {
      store.set(id, secret);
    },
    list: async () => [...store.keys()],
    remove: async (id) => {
      store.delete(id);
    },
  };
}

describe("createDefaultRouter", () => {
  it("registers ollama, anthropic, and openai providers", () => {
    const router = createDefaultRouter({
      credentials: fakeCredentialStore({
        anthropic: "ak",
        openai: "ok",
      }),
    });
    const ids = router.list().map((p) => p.id).sort();
    expect(ids).toEqual(["anthropic", "ollama", "openai"]);
  });

  it("uses injected credentials for cloud providers (no src/auth coupling)", async () => {
    const credentials = fakeCredentialStore({
      anthropic: "sk-ant-test",
      openai: "sk-oai-test",
    });
    const getSpy = vi.spyOn(credentials, "get");
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "hi" }],
            model: "claude",
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const router = createDefaultRouter({
      credentials,
      fetchImpl,
      ollamaBaseUrl: "http://127.0.0.1:1", // force ollama to fail
    });

    // ollama call will fail (fetchImpl returns an anthropic shape, but since
    // it's local-first, ollama is tried first); instead we force ollama to
    // fail by pointing at an unreachable base URL and stub fetch to throw
    // for that host.
    fetchImpl.mockImplementationOnce(async () => {
      throw new Error("ECONNREFUSED");
    });

    const res = await router.route({ prompt: "hi" });
    expect(res.providerId).toBe("anthropic");
    expect(getSpy).toHaveBeenCalledWith("anthropic");
  });

  it("route() fails gracefully when ollama is unreachable and cloud creds missing", async () => {
    const credentials = fakeCredentialStore();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("ECONNREFUSED");
    });
    const router = createDefaultRouter({
      credentials,
      fetchImpl,
    });

    await expect(router.route({ prompt: "hi" })).rejects.toThrow(
      /all providers failed/,
    );
  });

  it("anthropic getKey throws when credential is missing", async () => {
    const credentials = fakeCredentialStore();
    const router = createDefaultRouter({ credentials });
    const anthropic = router.list().find((p) => p.id === "anthropic");
    expect(anthropic).toBeDefined();
    await expect(
      anthropic!.complete({ prompt: "hi" }),
    ).rejects.toThrow(/missing credential for 'anthropic'/);
  });
});
