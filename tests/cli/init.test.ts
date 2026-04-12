import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit, WIZARD_PROVIDERS } from "../../src/cli/init.js";
import type { Prompter } from "../../src/cli/init-prompts.js";

interface AskCall {
  question: string;
  opts?: { default?: string; mask?: boolean };
}

type Answer =
  | { kind: "ask"; value: string }
  | { kind: "choose"; value: string }
  | { kind: "multi"; value: string[] }
  | { kind: "confirm"; value: boolean };

class ScriptedPrompter implements Prompter {
  public asks: AskCall[] = [];
  public printed: string[] = [];
  constructor(private readonly queue: Answer[]) {}

  private next(): Answer {
    const a = this.queue.shift();
    if (!a) throw new Error("ScriptedPrompter: queue empty");
    return a;
  }

  async ask(
    question: string,
    opts?: { default?: string; mask?: boolean },
  ): Promise<string> {
    this.asks.push({ question, opts });
    const a = this.next();
    if (a.kind !== "ask") {
      throw new Error(`expected ask, got ${a.kind}`);
    }
    return a.value;
  }

  async choose<T extends string>(
    _question: string,
    options: readonly T[],
  ): Promise<T> {
    const a = this.next();
    if (a.kind !== "choose") {
      throw new Error(`expected choose, got ${a.kind}`);
    }
    const found = options.find((o) => o === a.value);
    if (!found) {
      throw new Error(`choose value '${a.value}' not in options`);
    }
    return found;
  }

  async multiChoose<T extends string>(
    _question: string,
    options: readonly T[],
  ): Promise<T[]> {
    const a = this.next();
    if (a.kind !== "multi") {
      throw new Error(`expected multi, got ${a.kind}`);
    }
    const result: T[] = [];
    for (const v of a.value) {
      const found = options.find((o) => o === v);
      if (!found) throw new Error(`multi value '${v}' not in options`);
      result.push(found);
    }
    return result;
  }

  async confirm(_question: string): Promise<boolean> {
    const a = this.next();
    if (a.kind !== "confirm") {
      throw new Error(`expected confirm, got ${a.kind}`);
    }
    return a.value;
  }

  print(line: string): void {
    this.printed.push(line);
  }
}

const HEX_KEY = "a".repeat(64);

interface TmpPaths {
  configPath: string;
  credentialsPath: string;
}

function tmpPaths(): TmpPaths {
  const dir = mkdtempSync(join(tmpdir(), "argent-init-"));
  return {
    configPath: join(dir, "config.json"),
    credentialsPath: join(dir, "credentials.json.enc"),
  };
}

let dirs: string[] = [];

function track(paths: TmpPaths): TmpPaths {
  dirs.push(join(paths.configPath, ".."));
  return paths;
}

beforeEach(() => {
  dirs = [];
});

afterEach(() => {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe("runInit", () => {
  it("writes a standalone config with ollama-only selection", async () => {
    const paths = track(tmpPaths());
    const writes = new Map<string, string>();
    const prompter = new ScriptedPrompter([
      { kind: "choose", value: "standalone" },
      { kind: "multi", value: ["ollama"] },
    ]);

    const result = await runInit({
      prompter,
      configPath: paths.configPath,
      credentialsPath: paths.credentialsPath,
      masterKeyEnv: { ARGENT_MASTER_KEY: HEX_KEY },
      writeFile: async (p, c) => {
        writes.set(p, c);
      },
    });

    expect(result.mode).toBe("standalone");
    expect(result.providersConfigured).toEqual(["ollama"]);
    expect(result.noop).toBeUndefined();
    const written = writes.get(paths.configPath);
    expect(written).toBeDefined();
    const parsed = JSON.parse(written ?? "{}") as {
      mode: string;
      providers: string[];
      channels: string[];
      satellite?: unknown;
    };
    expect(parsed.mode).toBe("standalone");
    expect(parsed.providers).toEqual(["ollama"]);
    expect(parsed.channels).toEqual(["cli-stdio"]);
    expect(parsed.satellite).toBeUndefined();
  });

  it("stores credentials for cloud providers via the injected store backend", async () => {
    const paths = track(tmpPaths());
    const writes = new Map<string, string>();
    const prompter = new ScriptedPrompter([
      { kind: "choose", value: "standalone" },
      { kind: "multi", value: ["ollama", "anthropic", "openai"] },
      { kind: "ask", value: "sk-ant-xxx" },
      { kind: "ask", value: "sk-openai-xxx" },
    ]);

    const result = await runInit({
      prompter,
      configPath: paths.configPath,
      credentialsPath: paths.credentialsPath,
      masterKeyEnv: { ARGENT_MASTER_KEY: HEX_KEY },
      writeFile: async (p, c) => {
        writes.set(p, c);
      },
    });

    expect(result.providersConfigured).toEqual([
      "ollama",
      "anthropic",
      "openai",
    ]);

    // Verify credentials round-trip through a fresh store instance.
    const { createCredentialStore } = await import(
      "../../src/auth/credential-store.js"
    );
    const store = createCredentialStore({
      backend: "file",
      filePath: paths.credentialsPath,
      env: { ARGENT_MASTER_KEY: HEX_KEY },
    });
    expect(await store.get("anthropic")).toBe("sk-ant-xxx");
    expect(await store.get("openai")).toBe("sk-openai-xxx");
    const list = await store.list();
    expect(list).toEqual(["anthropic", "openai"]);
  });

  it("runs probe and aborts saving when probe fails and user declines", async () => {
    const paths = track(tmpPaths());
    const writes = new Map<string, string>();
    const prompter = new ScriptedPrompter([
      { kind: "choose", value: "standalone" },
      { kind: "multi", value: ["anthropic"] },
      { kind: "ask", value: "bogus" },
      { kind: "confirm", value: false },
    ]);

    const probed: Array<[string, string]> = [];
    const result = await runInit({
      prompter,
      configPath: paths.configPath,
      credentialsPath: paths.credentialsPath,
      masterKeyEnv: { ARGENT_MASTER_KEY: HEX_KEY },
      writeFile: async (p, c) => {
        writes.set(p, c);
      },
      probe: async (provider, key) => {
        probed.push([provider, key]);
        return false;
      },
    });

    expect(probed).toEqual([["anthropic", "bogus"]]);
    expect(result.providersConfigured).toEqual(["anthropic"]);
    // No credentials file should have been created since user declined save.
    const { existsSync } = await import("node:fs");
    expect(existsSync(paths.credentialsPath)).toBe(false);
  });

  it("captures base URL and HMAC secret for satellite mode", async () => {
    const paths = track(tmpPaths());
    const writes = new Map<string, string>();
    const pings: Array<[string, string]> = [];
    const prompter = new ScriptedPrompter([
      { kind: "choose", value: "satellite" },
      { kind: "multi", value: ["ollama"] },
      { kind: "ask", value: "https://mac.local:8787" },
      { kind: "ask", value: "hmac-secret-value" },
    ]);

    const result = await runInit({
      prompter,
      configPath: paths.configPath,
      credentialsPath: paths.credentialsPath,
      masterKeyEnv: { ARGENT_MASTER_KEY: HEX_KEY },
      writeFile: async (p, c) => {
        writes.set(p, c);
      },
      clientPing: async (url, secret) => {
        pings.push([url, secret]);
        return true;
      },
    });

    expect(result.mode).toBe("satellite");
    expect(pings).toEqual([["https://mac.local:8787", "hmac-secret-value"]]);
    const parsed = JSON.parse(writes.get(paths.configPath) ?? "{}") as {
      mode: string;
      satellite?: { host: string; secret: string };
    };
    expect(parsed.mode).toBe("satellite");
    expect(parsed.satellite).toEqual({
      host: "https://mac.local:8787",
      secret: "hmac-secret-value",
    });
  });

  it("generates a master key when env is missing and user opts in", async () => {
    const paths = track(tmpPaths());
    const writes = new Map<string, string>();
    const prompter = new ScriptedPrompter([
      { kind: "choose", value: "standalone" },
      { kind: "multi", value: ["ollama", "groq"] },
      { kind: "ask", value: "gsk-xxx" },
      { kind: "confirm", value: true },
    ]);

    const result = await runInit({
      prompter,
      configPath: paths.configPath,
      credentialsPath: paths.credentialsPath,
      masterKeyEnv: {},
      writeFile: async (p, c) => {
        writes.set(p, c);
      },
    });

    expect(result.generatedMasterKey).toMatch(/^[0-9a-f]{64}$/);
    expect(result.providersConfigured).toEqual(["ollama", "groq"]);

    // The generated key should unlock the credentials file we just wrote.
    const { createCredentialStore } = await import(
      "../../src/auth/credential-store.js"
    );
    const store = createCredentialStore({
      backend: "file",
      filePath: paths.credentialsPath,
      env: { ARGENT_MASTER_KEY: result.generatedMasterKey ?? "" },
    });
    expect(await store.get("groq")).toBe("gsk-xxx");
  });

  it("is a no-op when existing config is present and user declines overwrite", async () => {
    const paths = track(tmpPaths());
    // Seed an existing config.
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(paths.configPath, ".."), { recursive: true });
    writeFileSync(paths.configPath, "{}");

    const prompter = new ScriptedPrompter([{ kind: "confirm", value: false }]);

    const result = await runInit({
      prompter,
      configPath: paths.configPath,
      credentialsPath: paths.credentialsPath,
      masterKeyEnv: { ARGENT_MASTER_KEY: HEX_KEY },
      writeFile: async () => {
        throw new Error("writeFile should not be called");
      },
    });

    expect(result.noop).toBe(true);
    expect(result.providersConfigured).toEqual([]);
  });

  it("exposes the full wizard provider list", () => {
    expect(WIZARD_PROVIDERS).toContain("zai-coder");
    expect(WIZARD_PROVIDERS).toContain("zai-api");
    expect(WIZARD_PROVIDERS).toContain("openrouter");
  });
});
