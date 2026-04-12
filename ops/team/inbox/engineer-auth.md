# Task 020 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: init-wizard
Branch: codex/init-wizard (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/cli/init.ts
- src/cli/init-prompts.ts
- tests/cli/init.test.ts
- tests/cli/init-prompts.test.ts

## Goal

Interactive first-run wizard: `argent-lite init` (operator calls
`runInit()` from a new entrypoint). Writes config + credentials so
the service is ready to start.

### 1. `src/cli/init-prompts.ts` — pure prompt helpers

```ts
export interface Prompter {
  ask(question: string, opts?: { default?: string; mask?: boolean }): Promise<string>;
  choose<T extends string>(question: string, options: readonly T[], defaultIdx?: number): Promise<T>;
  multiChoose<T extends string>(question: string, options: readonly T[]): Promise<T[]>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  print(line: string): void;
}
export function createReadlinePrompter(stdin?: NodeJS.ReadableStream, stdout?: NodeJS.WritableStream): Prompter;
```

- Uses `node:readline`.
- `mask: true` → don't echo input (write `*` per char) for API keys.
- `multiChoose` shows a numbered list; user enters comma-separated indices.
- All methods return promises; no callbacks.

### 2. `src/cli/init.ts` — wizard orchestration

```ts
export interface InitOptions {
  prompter?: Prompter;
  configPath?: string;                   // default ~/.argent-lite/config.json
  credentialsPath?: string;               // default ~/.argent-lite/credentials.json.enc
  masterKeyEnv?: NodeJS.ProcessEnv;       // default process.env
  writeFile?: (path: string, content: string) => Promise<void>;
  probe?: (provider: string, key: string) => Promise<boolean>;  // optional live-verify
  clientPing?: (url: string, secret: string) => Promise<boolean>;  // satellite
}
export interface InitResult {
  configWritten: string;
  credentialsWritten: string;
  providersConfigured: string[];
  mode: "standalone" | "satellite";
}
export async function runInit(opts?: InitOptions): Promise<InitResult>;
```

Flow (each step is a call to `prompter`):

1. Check existing config at `configPath`. If present, `confirm("overwrite?")`. If no, exit with result marking no-op.
2. `choose("mode", ["standalone", "satellite"])`.
3. `multiChoose("providers", ["ollama", "groq", "openrouter", "zai-coder", "zai-api", "anthropic", "openai"])`. At least one required.
4. For each cloud provider (not ollama):
   - `ask("API key for <provider>", {mask: true})`
   - If `probe` option present, run it; on failure `confirm("save anyway?")`.
   - Collect `{providerId, secret}` pairs.
5. If `masterKeyEnv.ARGENT_MASTER_KEY` is absent:
   - `confirm("Generate a new master key?")`
   - If yes, generate via `crypto.randomBytes(32).toString("hex")` and print once with clear warning to save it in `/etc/default/argent-lite` or env.
6. Construct `createCredentialStore({backend: "file", path: credentialsPath})` and call `set()` for each cloud key.
7. If satellite: `ask("Mac brain base URL")`, `ask("HMAC secret", {mask: true})`, optionally probe with `clientPing`.
8. Build a `ArgentConfig` (from `src/config/schema.ts`) and JSON-stringify it to `configPath`.
9. Print success summary.

### 3. Tests

- `init-prompts.test.ts` — inject `PassThrough` streams for stdin+stdout:
  test ask/choose/multiChoose/confirm/mask all produce correct returns.
- `init.test.ts` — inject a fake `Prompter` that scripts answers via
  a queue, inject fake `writeFile` + `probe`, run `runInit`, assert:
  - config.json content is correct ArgentConfig
  - credentialsPath was written (mock CredentialStore if needed)
  - Providers list matches selection
  - Mode matches selection
  - Satellite path additionally captures base URL + secret

## Constraints

- Do NOT touch `bootRuntime`, `runtime-client.ts`, `credential-store.ts`,
  or `schema.ts` — consume them as imports.
- Do NOT prompt from test files via real TTY. Always inject Prompter.
- No new deps. Node built-ins only (`node:readline`, `node:crypto`).
- Strict TS, no `any`.

## Acceptance criterion

- 4 files, `pnpm check`, `pnpm test tests/cli/init*` all pass.
- Wizard is fully unit-tested via injection.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

Deadline: before next cron tick.
