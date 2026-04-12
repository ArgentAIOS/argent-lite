import { describe, expect, it } from "vitest";

import { createCredentialStore } from "../../src/auth/credential-store.js";
import { UnsupportedOperationError } from "../../src/auth/types.js";

describe("createCredentialStore (env backend)", () => {
  it("defaults to the env backend and reads from a supplied env map", async () => {
    const env: NodeJS.ProcessEnv = {
      ANTHROPIC_API_KEY: "sk-ant-test-123",
      OPENAI_API_KEY: "sk-openai-test-456",
    };
    const store = createCredentialStore({ env });

    await expect(store.get("anthropic")).resolves.toBe("sk-ant-test-123");
    await expect(store.get("openai")).resolves.toBe("sk-openai-test-456");
    await expect(store.get("ollama")).resolves.toBeUndefined();
  });

  it("lists only providers that have a non-empty env var set", async () => {
    const env: NodeJS.ProcessEnv = {
      ANTHROPIC_API_KEY: "sk-ant",
      OPENAI_API_KEY: "",
      OLLAMA_API_KEY: "local-key",
    };
    const store = createCredentialStore({ backend: "env", env });

    const listed = await store.list();
    expect(listed.sort()).toEqual(["anthropic", "ollama"]);
  });

  it("round-trips a read: a value present in env is returned on get", async () => {
    const env: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: "round-trip-value" };
    const store = createCredentialStore({ backend: "env", env });
    const got = await store.get("anthropic");
    expect(got).toBe("round-trip-value");
  });

  it("returns undefined for unknown provider ids", async () => {
    const store = createCredentialStore({ backend: "env", env: {} });
    await expect(store.get("does-not-exist")).resolves.toBeUndefined();
  });

  it("throws UnsupportedOperationError on set()", async () => {
    const store = createCredentialStore({ backend: "env", env: {} });
    await expect(store.set("anthropic", "nope")).rejects.toBeInstanceOf(
      UnsupportedOperationError,
    );
  });

  it("throws UnsupportedOperationError on remove()", async () => {
    const store = createCredentialStore({
      backend: "env",
      env: { ANTHROPIC_API_KEY: "present" },
    });
    await expect(store.remove("anthropic")).rejects.toBeInstanceOf(
      UnsupportedOperationError,
    );
  });
});
