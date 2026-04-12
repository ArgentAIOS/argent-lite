import { randomBytes } from "node:crypto";
import { mkdir, writeFile as fsWriteFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { createCredentialStore } from "../auth/credential-store.js";
import type {
  ArgentConfig,
  ChannelName,
  ProviderName,
  RuntimeMode,
} from "../config/schema.js";
import { PROVIDER_NAMES } from "../config/schema.js";
import {
  createReadlinePrompter,
  type Prompter,
} from "./init-prompts.js";

export type WizardProviderId =
  | "ollama"
  | "groq"
  | "openrouter"
  | "zai-coder"
  | "zai-api"
  | "anthropic"
  | "openai";

export const WIZARD_PROVIDERS: readonly WizardProviderId[] = [
  "ollama",
  "groq",
  "openrouter",
  "zai-coder",
  "zai-api",
  "anthropic",
  "openai",
] as const;

const WIZARD_MODES: readonly RuntimeMode[] = ["standalone", "satellite"];

export interface InitOptions {
  prompter?: Prompter;
  configPath?: string;
  credentialsPath?: string;
  masterKeyEnv?: NodeJS.ProcessEnv;
  writeFile?: (path: string, content: string) => Promise<void>;
  probe?: (provider: string, key: string) => Promise<boolean>;
  clientPing?: (url: string, secret: string) => Promise<boolean>;
}

export interface InitResult {
  configWritten: string;
  credentialsWritten: string;
  providersConfigured: WizardProviderId[];
  mode: RuntimeMode;
  noop?: boolean;
  generatedMasterKey?: string;
}

function defaultConfigPath(): string {
  return join(homedir(), ".argent-lite", "config.json");
}

function defaultCredentialsPath(): string {
  return join(homedir(), ".argent-lite", "credentials.json.enc");
}

async function defaultWriteFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await fsWriteFile(path, content, { mode: 0o600 });
}

function isSchemaProvider(id: string): id is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(id);
}

function buildConfig(
  mode: RuntimeMode,
  selected: readonly WizardProviderId[],
  satellite: { baseUrl: string; secret: string } | undefined,
): ArgentConfig {
  const providers: ProviderName[] = [];
  for (const id of selected) {
    if (isSchemaProvider(id) && !providers.includes(id)) {
      providers.push(id);
    }
  }
  if (providers.length === 0) {
    providers.push("ollama");
  }
  const channels: ChannelName[] = ["cli-stdio"];
  const config: ArgentConfig = {
    mode,
    logLevel: "info",
    providers,
    channels,
  };
  if (mode === "satellite" && satellite) {
    config.satellite = { host: satellite.baseUrl, secret: satellite.secret };
  }
  return config;
}

export async function runInit(opts: InitOptions = {}): Promise<InitResult> {
  const prompter = opts.prompter ?? createReadlinePrompter();
  const configPath = opts.configPath ?? defaultConfigPath();
  const credentialsPath = opts.credentialsPath ?? defaultCredentialsPath();
  const masterKeyEnv = opts.masterKeyEnv ?? process.env;
  const writeFile = opts.writeFile ?? defaultWriteFile;

  prompter.print("argent-lite init — first-run setup");

  if (existsSync(configPath)) {
    const overwrite = await prompter.confirm(
      `Config already exists at ${configPath}. Overwrite?`,
      false,
    );
    if (!overwrite) {
      prompter.print("Init cancelled — existing config left in place.");
      return {
        configWritten: configPath,
        credentialsWritten: credentialsPath,
        providersConfigured: [],
        mode: "standalone",
        noop: true,
      };
    }
  }

  const mode = await prompter.choose<RuntimeMode>(
    "Select runtime mode:",
    WIZARD_MODES,
    0,
  );

  const selected = await prompter.multiChoose<WizardProviderId>(
    "Select providers to enable (at least one):",
    WIZARD_PROVIDERS,
  );
  if (selected.length === 0) {
    throw new Error("init: at least one provider must be selected");
  }

  const cloudSelections = selected.filter((p) => p !== "ollama");
  const secrets: Array<{ providerId: WizardProviderId; secret: string }> = [];
  for (const providerId of cloudSelections) {
    const key = await prompter.ask(`API key for ${providerId}`, { mask: true });
    if (key.length === 0) {
      throw new Error(`init: empty API key for ${providerId}`);
    }
    if (opts.probe) {
      let ok = false;
      try {
        ok = await opts.probe(providerId, key);
      } catch {
        ok = false;
      }
      if (!ok) {
        const saveAnyway = await prompter.confirm(
          `Probe for ${providerId} failed. Save anyway?`,
          false,
        );
        if (!saveAnyway) continue;
      }
    }
    secrets.push({ providerId, secret: key });
  }

  let generatedMasterKey: string | undefined;
  const effectiveEnv: NodeJS.ProcessEnv = { ...masterKeyEnv };
  if (!effectiveEnv.ARGENT_MASTER_KEY || effectiveEnv.ARGENT_MASTER_KEY.length === 0) {
    const generate = await prompter.confirm(
      "ARGENT_MASTER_KEY is not set. Generate a new master key now?",
      true,
    );
    if (generate) {
      generatedMasterKey = randomBytes(32).toString("hex");
      effectiveEnv.ARGENT_MASTER_KEY = generatedMasterKey;
      prompter.print("");
      prompter.print("=== NEW ARGENT_MASTER_KEY — SAVE THIS NOW ===");
      prompter.print(generatedMasterKey);
      prompter.print(
        "Add it to /etc/default/argent-lite or export ARGENT_MASTER_KEY before starting the service.",
      );
      prompter.print("It will NOT be shown again.");
      prompter.print("");
    } else if (secrets.length > 0) {
      throw new Error(
        "init: cannot save credentials without ARGENT_MASTER_KEY",
      );
    }
  }

  if (secrets.length > 0) {
    const store = createCredentialStore({
      backend: "file",
      filePath: credentialsPath,
      env: effectiveEnv,
    });
    for (const { providerId, secret } of secrets) {
      await store.set(providerId, secret);
    }
  }

  let satelliteConfig: { baseUrl: string; secret: string } | undefined;
  if (mode === "satellite") {
    const baseUrl = await prompter.ask("Mac brain base URL");
    if (baseUrl.length === 0) {
      throw new Error("init: satellite mode requires a base URL");
    }
    const secret = await prompter.ask("HMAC secret", { mask: true });
    if (secret.length === 0) {
      throw new Error("init: satellite mode requires an HMAC secret");
    }
    if (opts.clientPing) {
      let ok = false;
      try {
        ok = await opts.clientPing(baseUrl, secret);
      } catch {
        ok = false;
      }
      if (!ok) {
        const saveAnyway = await prompter.confirm(
          `Ping to ${baseUrl} failed. Save anyway?`,
          false,
        );
        if (!saveAnyway) {
          throw new Error("init: satellite ping failed, cancelled by user");
        }
      }
    }
    satelliteConfig = { baseUrl, secret };
  }

  const config = buildConfig(mode, selected, satelliteConfig);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  prompter.print("");
  prompter.print("Init complete.");
  prompter.print(`  config:      ${configPath}`);
  prompter.print(`  credentials: ${credentialsPath}`);
  prompter.print(`  mode:        ${mode}`);
  prompter.print(`  providers:   ${selected.join(", ")}`);

  return {
    configWritten: configPath,
    credentialsWritten: credentialsPath,
    providersConfigured: selected,
    mode,
    generatedMasterKey,
  };
}
