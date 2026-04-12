import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/config/loader.js";
import { ConfigError, DEFAULT_CONFIG } from "../../src/config/schema.js";

const emptyReadFile = (): string | undefined => undefined;

describe("loadConfig", () => {
  it("returns defaults when nothing is given", () => {
    const cfg = loadConfig({ argv: [], env: {}, readFile: emptyReadFile });
    expect(cfg.mode).toBe(DEFAULT_CONFIG.mode);
    expect(cfg.logLevel).toBe(DEFAULT_CONFIG.logLevel);
    expect(cfg.providers).toEqual(DEFAULT_CONFIG.providers);
    expect(cfg.channels).toEqual(DEFAULT_CONFIG.channels);
    expect(cfg.httpChannel).toBeUndefined();
    expect(cfg.satellite).toBeUndefined();
  });

  it("applies env var overrides", () => {
    const cfg = loadConfig({
      argv: [],
      env: {
        ARGENT_MODE: "satellite",
        ARGENT_LOG_LEVEL: "debug",
        ARGENT_PROVIDERS: "ollama,anthropic",
        ARGENT_CHANNELS: "cli-stdio,http",
        ARGENT_HTTP_PORT: "8080",
        ARGENT_HTTP_HOST: "127.0.0.1",
        ARGENT_SATELLITE_SECRET: "s3cr3t",
        ARGENT_SATELLITE_HOST: "mac.local",
        ARGENT_HOME: "/tmp/argent",
      },
      readFile: emptyReadFile,
    });
    expect(cfg.mode).toBe("satellite");
    expect(cfg.logLevel).toBe("debug");
    expect(cfg.providers).toEqual(["ollama", "anthropic"]);
    expect(cfg.channels).toEqual(["cli-stdio", "http"]);
    expect(cfg.httpChannel).toEqual({ port: 8080, host: "127.0.0.1" });
    expect(cfg.satellite).toEqual({ secret: "s3cr3t", host: "mac.local" });
    expect(cfg.memoryPath).toBe("/tmp/argent");
  });

  it("CLI flags override env vars", () => {
    const cfg = loadConfig({
      argv: [
        "--mode",
        "standalone",
        "--log-level=warn",
        "--providers",
        "ollama",
        "--channels=cli-stdio",
      ],
      env: {
        ARGENT_MODE: "satellite",
        ARGENT_LOG_LEVEL: "debug",
        ARGENT_PROVIDERS: "anthropic",
        ARGENT_CHANNELS: "http",
      },
      readFile: emptyReadFile,
    });
    expect(cfg.mode).toBe("standalone");
    expect(cfg.logLevel).toBe("warn");
    expect(cfg.providers).toEqual(["ollama"]);
    expect(cfg.channels).toEqual(["cli-stdio"]);
  });

  it("config file sits below env", () => {
    const file = JSON.stringify({
      mode: "satellite",
      logLevel: "error",
      providers: ["openai"],
      channels: ["http"],
    });
    const cfg = loadConfig({
      argv: [],
      env: { ARGENT_MODE: "standalone", ARGENT_LOG_LEVEL: "info" },
      configPath: "/fake/config.json",
      readFile: (p) => (p === "/fake/config.json" ? file : undefined),
    });
    expect(cfg.mode).toBe("standalone");
    expect(cfg.logLevel).toBe("info");
    expect(cfg.providers).toEqual(["openai"]);
    expect(cfg.channels).toEqual(["http"]);
  });

  it("throws on invalid mode", () => {
    expect(() =>
      loadConfig({
        argv: [],
        env: { ARGENT_MODE: "bogus" },
        readFile: emptyReadFile,
      }),
    ).toThrow(ConfigError);
  });

  it("throws on unknown provider", () => {
    expect(() =>
      loadConfig({
        argv: [],
        env: { ARGENT_PROVIDERS: "ollama,madeup" },
        readFile: emptyReadFile,
      }),
    ).toThrow(ConfigError);
  });

  it("throws on unknown channel", () => {
    expect(() =>
      loadConfig({
        argv: ["--channels", "cli-stdio,telepathy"],
        env: {},
        readFile: emptyReadFile,
      }),
    ).toThrow(ConfigError);
  });

  it("uses injected readFile (no real fs)", () => {
    let seen = "";
    const cfg = loadConfig({
      argv: [],
      env: {},
      configPath: "/virtual/path.json",
      readFile: (p) => {
        seen = p;
        return JSON.stringify({ logLevel: "debug" });
      },
    });
    expect(seen).toBe("/virtual/path.json");
    expect(cfg.logLevel).toBe("debug");
  });

  it("throws on unknown CLI flag", () => {
    expect(() =>
      loadConfig({
        argv: ["--bogus", "x"],
        env: {},
        readFile: emptyReadFile,
      }),
    ).toThrow(ConfigError);
  });

  it("throws on invalid JSON config file", () => {
    expect(() =>
      loadConfig({
        argv: [],
        env: {},
        configPath: "/fake.json",
        readFile: () => "{not json",
      }),
    ).toThrow(ConfigError);
  });

  it("rejects unknown keys in config file", () => {
    expect(() =>
      loadConfig({
        argv: [],
        env: {},
        configPath: "/fake.json",
        readFile: () => JSON.stringify({ surpriseKey: 1 }),
      }),
    ).toThrow(ConfigError);
  });

  it("env httpChannel requires both port and host", () => {
    expect(() =>
      loadConfig({
        argv: [],
        env: { ARGENT_HTTP_PORT: "9000" },
        readFile: emptyReadFile,
      }),
    ).toThrow(ConfigError);
  });
});
