import { describe, expect, it } from "vitest";

import { withRotation } from "../../src/auth/rotation.js";
import type { CredentialStore } from "../../src/auth/types.js";

function createMemoryStore(): CredentialStore {
  const data = new Map<string, string>();
  return {
    async get(providerId: string): Promise<string | undefined> {
      return data.get(providerId);
    },
    async set(providerId: string, secret: string): Promise<void> {
      data.set(providerId, secret);
    },
    async list(): Promise<string[]> {
      return [...data.keys()];
    },
    async remove(providerId: string): Promise<void> {
      data.delete(providerId);
    },
  };
}

describe("withRotation", () => {
  it("records a rotation timestamp when set() is called", async () => {
    let clock = 1_000;
    const store = withRotation({
      inner: createMemoryStore(),
      now: () => clock,
    });

    await store.set("anthropic", "sk-ant");

    await expect(store.lastRotated("anthropic")).resolves.toBe(1_000);
    await expect(store.get("anthropic")).resolves.toBe("sk-ant");
    clock += 5;
  });

  it("reports stale=true for a provider that has never been rotated", async () => {
    const store = withRotation({
      inner: createMemoryStore(),
      now: () => 10_000,
    });

    await expect(store.stale("anthropic")).resolves.toBe(true);
    await expect(store.lastRotated("anthropic")).resolves.toBeUndefined();
  });

  it("reports stale=false immediately after a rotation", async () => {
    let clock = 500;
    const store = withRotation({
      inner: createMemoryStore(),
      now: () => clock,
      maxAgeMs: 1_000,
    });

    await store.set("openai", "sk-openai");
    await expect(store.stale("openai")).resolves.toBe(false);

    clock += 100;
    await expect(store.stale("openai")).resolves.toBe(false);
  });

  it("reports stale=true once simulated time exceeds maxAgeMs", async () => {
    let clock = 0;
    const store = withRotation({
      inner: createMemoryStore(),
      now: () => clock,
      maxAgeMs: 1_000,
    });

    await store.set("ollama", "local-key");
    clock = 1_001;
    await expect(store.stale("ollama")).resolves.toBe(true);

    const perCallOverride = await store.stale("ollama", 5_000);
    expect(perCallOverride).toBe(false);
  });

  it("markRotated() refreshes the timestamp without changing the secret", async () => {
    let clock = 100;
    const inner = createMemoryStore();
    const store = withRotation({
      inner,
      now: () => clock,
      maxAgeMs: 50,
    });

    await store.set("anthropic", "sk-ant");
    clock = 200;
    await expect(store.stale("anthropic")).resolves.toBe(true);

    await store.markRotated("anthropic");
    await expect(store.lastRotated("anthropic")).resolves.toBe(200);
    await expect(store.stale("anthropic")).resolves.toBe(false);
    await expect(store.get("anthropic")).resolves.toBe("sk-ant");
  });

  it("list() hides the rotation-timestamp bookkeeping keys", async () => {
    const store = withRotation({
      inner: createMemoryStore(),
      now: () => 1,
    });

    await store.set("anthropic", "a");
    await store.set("openai", "b");

    const listed = (await store.list()).sort();
    expect(listed).toEqual(["anthropic", "openai"]);
  });

  it("remove() clears both the secret and the rotation timestamp", async () => {
    const inner = createMemoryStore();
    const store = withRotation({ inner, now: () => 42 });

    await store.set("anthropic", "sk-ant");
    await store.remove("anthropic");

    await expect(store.get("anthropic")).resolves.toBeUndefined();
    await expect(store.lastRotated("anthropic")).resolves.toBeUndefined();
    await expect(inner.list()).resolves.toEqual([]);
  });
});
