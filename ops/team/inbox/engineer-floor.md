# Task 017 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: config-loader-impl
Branch: codex/config-loader-impl (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- src/config/loader.ts
- src/config/schema.ts
- tests/config/loader.test.ts

## Goal

Implement the config loader.

1. **`src/config/schema.ts`**:
   ```ts
   export interface ArgentConfig {
     mode: "satellite" | "standalone";
     memoryPath?: string;
     logLevel: "debug" | "info" | "warn" | "error";
     providers: string[];           // allowlist: "ollama" | "anthropic" | "openai" | "hailo"
     channels: string[];            // enabled: "cli-stdio" | "http" | "file-watch"
     httpChannel?: { port: number; host: string };
     satellite?: { secret: string; host: string };
   }
   export const DEFAULT_CONFIG: ArgentConfig = { ... };
   ```
2. **`src/config/loader.ts`**:
   ```ts
   export interface LoadConfigOptions {
     argv?: string[];
     env?: NodeJS.ProcessEnv;
     configPath?: string;
     readFile?: (p: string) => string | undefined;
   }
   export function loadConfig(opts?: LoadConfigOptions): ArgentConfig;
   ```
   - Precedence: CLI flags > env vars > config file > `DEFAULT_CONFIG`.
   - Env vars: `ARGENT_MODE`, `ARGENT_HOME`, `ARGENT_LOG_LEVEL`,
     `ARGENT_PROVIDERS` (comma-separated), `ARGENT_CHANNELS`,
     `ARGENT_HTTP_PORT`, `ARGENT_HTTP_HOST`, `ARGENT_SATELLITE_SECRET`,
     `ARGENT_SATELLITE_HOST`.
   - CLI flags: `--mode`, `--log-level`, `--providers`, `--channels`, etc.
   - Config file: JSON at `~/.argent-lite/config.json` (path overridable).
   - Strict validation: unknown mode/provider/channel throws `ConfigError`.
3. **`tests/config/loader.test.ts`**:
   - Default when nothing given.
   - Env var override.
   - CLI flag overrides env.
   - Config file is below env.
   - Invalid mode throws.
   - Unknown provider throws.
   - Readfile injected (no real fs).

## Constraints

- Do NOT touch `src/config/mode.ts` — this is additive.
- Node built-ins only.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
