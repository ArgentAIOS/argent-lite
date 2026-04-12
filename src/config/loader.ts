import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  CHANNEL_NAMES,
  ConfigError,
  DEFAULT_CONFIG,
  LOG_LEVELS,
  PROVIDER_NAMES,
  RUNTIME_MODES,
  type ArgentConfig,
  type ChannelName,
  type HttpChannelConfig,
  type LogLevel,
  type ProviderName,
  type RuntimeMode,
  type SatelliteConfig,
} from "./schema.js";

export interface LoadConfigOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  readFile?: (path: string) => string | undefined;
}

interface PartialConfig {
  mode?: RuntimeMode;
  memoryPath?: string;
  logLevel?: LogLevel;
  providers?: ProviderName[];
  channels?: ChannelName[];
  httpChannel?: Partial<HttpChannelConfig>;
  satellite?: Partial<SatelliteConfig>;
}

function parseMode(value: string, source: string): RuntimeMode {
  const v = value.trim().toLowerCase();
  if (!(RUNTIME_MODES as readonly string[]).includes(v)) {
    throw new ConfigError(
      `Invalid mode ${JSON.stringify(value)} from ${source}; expected one of ${RUNTIME_MODES.join(", ")}`,
    );
  }
  return v as RuntimeMode;
}

function parseLogLevel(value: string, source: string): LogLevel {
  const v = value.trim().toLowerCase();
  if (!(LOG_LEVELS as readonly string[]).includes(v)) {
    throw new ConfigError(
      `Invalid logLevel ${JSON.stringify(value)} from ${source}; expected one of ${LOG_LEVELS.join(", ")}`,
    );
  }
  return v as LogLevel;
}

function parseProviderList(
  value: readonly string[] | string,
  source: string,
): ProviderName[] {
  const raw = typeof value === "string" ? value.split(",") : value;
  const out: ProviderName[] = [];
  for (const entry of raw) {
    const v = entry.trim().toLowerCase();
    if (v === "") continue;
    if (!(PROVIDER_NAMES as readonly string[]).includes(v)) {
      throw new ConfigError(
        `Invalid provider ${JSON.stringify(entry)} from ${source}; expected one of ${PROVIDER_NAMES.join(", ")}`,
      );
    }
    out.push(v as ProviderName);
  }
  return out;
}

function parseChannelList(
  value: readonly string[] | string,
  source: string,
): ChannelName[] {
  const raw = typeof value === "string" ? value.split(",") : value;
  const out: ChannelName[] = [];
  for (const entry of raw) {
    const v = entry.trim().toLowerCase();
    if (v === "") continue;
    if (!(CHANNEL_NAMES as readonly string[]).includes(v)) {
      throw new ConfigError(
        `Invalid channel ${JSON.stringify(entry)} from ${source}; expected one of ${CHANNEL_NAMES.join(", ")}`,
      );
    }
    out.push(v as ChannelName);
  }
  return out;
}

function parsePort(value: string, source: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new ConfigError(
      `Invalid port ${JSON.stringify(value)} from ${source}; expected integer 0..65535`,
    );
  }
  return n;
}

function parseArgv(argv: readonly string[]): PartialConfig {
  const out: PartialConfig = {};
  const source = "CLI flag";
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    let key: string;
    let value: string | undefined;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq >= 0) {
        key = arg.slice(2, eq);
        value = arg.slice(eq + 1);
        i += 1;
      } else {
        key = arg.slice(2);
        value = argv[i + 1];
        i += 2;
      }
    } else {
      i += 1;
      continue;
    }
    if (value === undefined) {
      throw new ConfigError(`CLI flag --${key} requires a value`);
    }
    switch (key) {
      case "mode":
        out.mode = parseMode(value, source);
        break;
      case "memory-path":
        out.memoryPath = value;
        break;
      case "log-level":
        out.logLevel = parseLogLevel(value, source);
        break;
      case "providers":
        out.providers = parseProviderList(value, source);
        break;
      case "channels":
        out.channels = parseChannelList(value, source);
        break;
      case "http-port":
        out.httpChannel = {
          ...(out.httpChannel ?? {}),
          port: parsePort(value, source),
        };
        break;
      case "http-host":
        out.httpChannel = { ...(out.httpChannel ?? {}), host: value };
        break;
      case "satellite-secret":
        out.satellite = { ...(out.satellite ?? {}), secret: value };
        break;
      case "satellite-host":
        out.satellite = { ...(out.satellite ?? {}), host: value };
        break;
      default:
        throw new ConfigError(`Unknown CLI flag --${key}`);
    }
  }
  return out;
}

function parseEnv(env: NodeJS.ProcessEnv): PartialConfig {
  const out: PartialConfig = {};
  const source = "env";
  const mode = env.ARGENT_MODE;
  if (mode !== undefined && mode !== "") out.mode = parseMode(mode, source);
  const home = env.ARGENT_HOME;
  if (home !== undefined && home !== "") out.memoryPath = home;
  const log = env.ARGENT_LOG_LEVEL;
  if (log !== undefined && log !== "") out.logLevel = parseLogLevel(log, source);
  const providers = env.ARGENT_PROVIDERS;
  if (providers !== undefined && providers !== "")
    out.providers = parseProviderList(providers, source);
  const channels = env.ARGENT_CHANNELS;
  if (channels !== undefined && channels !== "")
    out.channels = parseChannelList(channels, source);
  const port = env.ARGENT_HTTP_PORT;
  if (port !== undefined && port !== "") {
    out.httpChannel = {
      ...(out.httpChannel ?? {}),
      port: parsePort(port, source),
    };
  }
  const host = env.ARGENT_HTTP_HOST;
  if (host !== undefined && host !== "") {
    out.httpChannel = { ...(out.httpChannel ?? {}), host };
  }
  const secret = env.ARGENT_SATELLITE_SECRET;
  if (secret !== undefined && secret !== "") {
    out.satellite = { ...(out.satellite ?? {}), secret };
  }
  const satHost = env.ARGENT_SATELLITE_HOST;
  if (satHost !== undefined && satHost !== "") {
    out.satellite = { ...(out.satellite ?? {}), host: satHost };
  }
  return out;
}

function parseFileContent(raw: string, path: string): PartialConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      `Failed to parse config file ${path}: ${(err as Error).message}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError(`Config file ${path} must contain a JSON object`);
  }
  const obj = parsed as Record<string, unknown>;
  const source = `file:${path}`;
  const out: PartialConfig = {};
  if (obj.mode !== undefined) {
    if (typeof obj.mode !== "string")
      throw new ConfigError(`${source}: mode must be a string`);
    out.mode = parseMode(obj.mode, source);
  }
  if (obj.memoryPath !== undefined) {
    if (typeof obj.memoryPath !== "string")
      throw new ConfigError(`${source}: memoryPath must be a string`);
    out.memoryPath = obj.memoryPath;
  }
  if (obj.logLevel !== undefined) {
    if (typeof obj.logLevel !== "string")
      throw new ConfigError(`${source}: logLevel must be a string`);
    out.logLevel = parseLogLevel(obj.logLevel, source);
  }
  if (obj.providers !== undefined) {
    if (!Array.isArray(obj.providers))
      throw new ConfigError(`${source}: providers must be an array`);
    out.providers = parseProviderList(
      obj.providers.map((v) => {
        if (typeof v !== "string")
          throw new ConfigError(`${source}: provider entries must be strings`);
        return v;
      }),
      source,
    );
  }
  if (obj.channels !== undefined) {
    if (!Array.isArray(obj.channels))
      throw new ConfigError(`${source}: channels must be an array`);
    out.channels = parseChannelList(
      obj.channels.map((v) => {
        if (typeof v !== "string")
          throw new ConfigError(`${source}: channel entries must be strings`);
        return v;
      }),
      source,
    );
  }
  if (obj.httpChannel !== undefined) {
    if (
      obj.httpChannel === null ||
      typeof obj.httpChannel !== "object" ||
      Array.isArray(obj.httpChannel)
    ) {
      throw new ConfigError(`${source}: httpChannel must be an object`);
    }
    const hc = obj.httpChannel as Record<string, unknown>;
    const partial: Partial<HttpChannelConfig> = {};
    if (hc.port !== undefined) {
      if (typeof hc.port !== "number" || !Number.isInteger(hc.port))
        throw new ConfigError(`${source}: httpChannel.port must be an integer`);
      partial.port = parsePort(String(hc.port), source);
    }
    if (hc.host !== undefined) {
      if (typeof hc.host !== "string")
        throw new ConfigError(`${source}: httpChannel.host must be a string`);
      partial.host = hc.host;
    }
    out.httpChannel = partial;
  }
  if (obj.satellite !== undefined) {
    if (
      obj.satellite === null ||
      typeof obj.satellite !== "object" ||
      Array.isArray(obj.satellite)
    ) {
      throw new ConfigError(`${source}: satellite must be an object`);
    }
    const sat = obj.satellite as Record<string, unknown>;
    const partial: Partial<SatelliteConfig> = {};
    if (sat.secret !== undefined) {
      if (typeof sat.secret !== "string")
        throw new ConfigError(`${source}: satellite.secret must be a string`);
      partial.secret = sat.secret;
    }
    if (sat.host !== undefined) {
      if (typeof sat.host !== "string")
        throw new ConfigError(`${source}: satellite.host must be a string`);
      partial.host = sat.host;
    }
    out.satellite = partial;
  }
  const known = new Set([
    "mode",
    "memoryPath",
    "logLevel",
    "providers",
    "channels",
    "httpChannel",
    "satellite",
  ]);
  for (const key of Object.keys(obj)) {
    if (!known.has(key)) {
      throw new ConfigError(`${source}: unknown key ${JSON.stringify(key)}`);
    }
  }
  return out;
}

function defaultReadFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    throw err;
  }
}

function mergeHttp(
  base: HttpChannelConfig | undefined,
  patch: Partial<HttpChannelConfig> | undefined,
): HttpChannelConfig | undefined {
  if (!patch) return base;
  const merged: Partial<HttpChannelConfig> = { ...(base ?? {}), ...patch };
  if (merged.port === undefined || merged.host === undefined) {
    throw new ConfigError(
      `httpChannel requires both port and host when configured`,
    );
  }
  return { port: merged.port, host: merged.host };
}

function mergeSatellite(
  base: SatelliteConfig | undefined,
  patch: Partial<SatelliteConfig> | undefined,
): SatelliteConfig | undefined {
  if (!patch) return base;
  const merged: Partial<SatelliteConfig> = { ...(base ?? {}), ...patch };
  if (merged.secret === undefined || merged.host === undefined) {
    throw new ConfigError(
      `satellite requires both secret and host when configured`,
    );
  }
  return { secret: merged.secret, host: merged.host };
}

function merge(base: ArgentConfig, patch: PartialConfig): ArgentConfig {
  const next: ArgentConfig = {
    mode: patch.mode ?? base.mode,
    logLevel: patch.logLevel ?? base.logLevel,
    providers: patch.providers ?? base.providers,
    channels: patch.channels ?? base.channels,
  };
  const memoryPath = patch.memoryPath ?? base.memoryPath;
  if (memoryPath !== undefined) next.memoryPath = memoryPath;
  const http = mergeHttp(base.httpChannel, patch.httpChannel);
  if (http !== undefined) next.httpChannel = http;
  const sat = mergeSatellite(base.satellite, patch.satellite);
  if (sat !== undefined) next.satellite = sat;
  return next;
}

export function loadConfig(opts: LoadConfigOptions = {}): ArgentConfig {
  const env = opts.env ?? process.env;
  const readFile = opts.readFile ?? defaultReadFile;
  const argv = opts.argv ?? [];

  const configPath =
    opts.configPath ?? join(homedir(), ".argent-lite", "config.json");

  const fileRaw = readFile(configPath);
  const filePatch =
    fileRaw !== undefined ? parseFileContent(fileRaw, configPath) : {};
  const envPatch = parseEnv(env);
  const argvPatch = parseArgv(argv);

  let cfg: ArgentConfig = {
    mode: DEFAULT_CONFIG.mode,
    logLevel: DEFAULT_CONFIG.logLevel,
    providers: [...DEFAULT_CONFIG.providers],
    channels: [...DEFAULT_CONFIG.channels],
  };
  cfg = merge(cfg, filePatch);
  cfg = merge(cfg, envPatch);
  cfg = merge(cfg, argvPatch);
  return cfg;
}
