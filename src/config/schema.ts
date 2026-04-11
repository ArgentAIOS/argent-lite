export type RuntimeMode = "satellite" | "standalone";

export const RUNTIME_MODES: readonly RuntimeMode[] = [
  "satellite",
  "standalone",
] as const;

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
] as const;

export type ProviderName = "ollama" | "anthropic" | "openai" | "hailo";

export const PROVIDER_NAMES: readonly ProviderName[] = [
  "ollama",
  "anthropic",
  "openai",
  "hailo",
] as const;

export type ChannelName = "cli-stdio" | "http" | "file-watch";

export const CHANNEL_NAMES: readonly ChannelName[] = [
  "cli-stdio",
  "http",
  "file-watch",
] as const;

export interface HttpChannelConfig {
  port: number;
  host: string;
}

export interface SatelliteConfig {
  secret: string;
  host: string;
}

export interface ArgentConfig {
  mode: RuntimeMode;
  memoryPath?: string;
  logLevel: LogLevel;
  providers: ProviderName[];
  channels: ChannelName[];
  httpChannel?: HttpChannelConfig;
  satellite?: SatelliteConfig;
}

export const DEFAULT_CONFIG: ArgentConfig = {
  mode: "standalone",
  logLevel: "info",
  providers: ["ollama"],
  channels: ["cli-stdio"],
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
