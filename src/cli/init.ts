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

    // ── Sync keys to argentos-core gateway auth-profiles.json ──────────
    // The argentos-core gateway uses its own auth-profiles.json per agent
    // directory. If the gateway agent dir exists, write the same keys
    // there so the operator doesn't have to configure them twice.
    const gatewayAgentDir = join(
      homedir(),
      ".argentos-dev",
      "agents",
      "dev",
      "agent",
    );
    try {
      await syncGatewayAuthProfiles(
        gatewayAgentDir,
        secrets,
        writeFile,
        prompter,
      );
    } catch {
      // Best-effort — if the gateway dir doesn't exist or the write
      // fails, it's not blocking. The operator can configure the
      // gateway separately.
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


// ── Gateway auth-profiles sync ─────────────────────────────────────────────

/** Map argent-lite provider IDs to argentos-core gateway provider names + default models. */
const GATEWAY_PROVIDER_MAP: Record<
  string,
  { provider: string; model: string } | undefined
> = {
  groq: { provider: "groq", model: "llama-3.1-8b-instant" },
  openrouter: { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct" },
  anthropic: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  openai: { provider: "openai", model: "gpt-4o-mini" },
  "zai-coder": { provider: "zai", model: "glm-4.6" },
  "zai-api": { provider: "zai", model: "glm-4.6" },
};

async function syncGatewayAuthProfiles(
  agentDir: string,
  secrets: Array<{ providerId: string; secret: string }>,
  writeFileFn: (path: string, content: string) => Promise<void>,
  prompter: Prompter,
): Promise<void> {
  if (!existsSync(agentDir)) {
    // Gateway agent dir doesn't exist — gateway not installed. Skip quietly.
    return;
  }

  const profiles = secrets
    .filter((s) => GATEWAY_PROVIDER_MAP[s.providerId] != null)
    .map((s, i) => {
      const mapping = GATEWAY_PROVIDER_MAP[s.providerId]!;
      return {
        id: `${s.providerId}-auto`,
        provider: mapping.provider,
        model: mapping.model,
        apiKey: s.secret,
        default: i === 0,
        active: true,
      };
    });

  if (profiles.length === 0) return;

  const filePath = join(agentDir, "auth-profiles.json");
  const content = JSON.stringify({ profiles }, null, 2) + "\n";

  await mkdir(agentDir, { recursive: true });
  await writeFileFn(filePath, content);

  prompter.print(`  gateway auth: ${filePath} (${profiles.length} profiles synced)`);
}
