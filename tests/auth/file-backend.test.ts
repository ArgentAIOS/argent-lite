import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileBackend } from "../../src/auth/file-backend.js";
import { CredentialStoreError } from "../../src/auth/types.js";

describe("file backend (AES-256-GCM)", () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "argent-lite-auth-"));
    filePath = join(tempDir, "credentials.json.enc");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("round-trips a secret through set/get/list/remove", async () => {
    const env: NodeJS.ProcessEnv = {
      ARGENT_MASTER_KEY: "a".repeat(64),
    };
    const store = createFileBackend({ filePath, env });

    await store.set("anthropic", "sk-ant-secret-value");
    await store.set("openai", "sk-openai-secret-value");

    await expect(store.get("anthropic")).resolves.toBe("sk-ant-secret-value");
    await expect(store.get("openai")).resolves.toBe("sk-openai-secret-value");

    const listed = await store.list();
    expect(listed.sort()).toEqual(["anthropic", "openai"]);

    await store.remove("anthropic");
    await expect(store.get("anthropic")).resolves.toBeUndefined();
    await expect(store.list()).resolves.toEqual(["openai"]);
  });

  it("writes the file encrypted — plaintext secret does not appear on disk", async () => {
    const env: NodeJS.ProcessEnv = { ARGENT_MASTER_KEY: "b".repeat(64) };
    const store = createFileBackend({ filePath, env });

    const secret = "UNIQUE-PLAINTEXT-NEEDLE-9f3a2b";
    await store.set("anthropic", secret);

    const onDisk = readFileSync(filePath, "utf8");
    expect(onDisk).not.toContain(secret);
    expect(onDisk).toContain("aes-256-gcm");
  });

  it("throws CredentialStoreError when ARGENT_MASTER_KEY is missing", async () => {
    const store = createFileBackend({ filePath, env: {} });
    await expect(store.get("anthropic")).rejects.toBeInstanceOf(CredentialStoreError);
    await expect(store.set("anthropic", "x")).rejects.toBeInstanceOf(
      CredentialStoreError,
    );
  });

  it("throws CredentialStoreError when decrypting with a wrong master key", async () => {
    const writer = createFileBackend({
      filePath,
      env: { ARGENT_MASTER_KEY: "correct-master-key-correct-master-key" },
    });
    await writer.set("anthropic", "sk-ant-secret-value");

    const reader = createFileBackend({
      filePath,
      env: { ARGENT_MASTER_KEY: "wrong-master-key-wrong-master-key-wrong" },
    });
    await expect(reader.get("anthropic")).rejects.toBeInstanceOf(CredentialStoreError);
  });

  it("returns undefined for a provider that was never set", async () => {
    const env: NodeJS.ProcessEnv = { ARGENT_MASTER_KEY: "c".repeat(64) };
    const store = createFileBackend({ filePath, env });
    await expect(store.get("ollama")).resolves.toBeUndefined();
  });
});
