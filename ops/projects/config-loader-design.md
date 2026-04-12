# Argent Lite — Config Loader Design

**Status:** planning (slice `config-loader-design`) | **Author:** architect
**Scope:** how Argent Lite loads runtime config beyond the single
`ARGENT_MODE` env var that `src/config/mode.ts` reads today.
**Non-goal:** implementing the loader. Shape + policy only.

## 1. Sources and precedence

Highest wins. Later sources override earlier ones only for fields they
explicitly set; unset fields fall through.

1. **CLI flags** — `--mode`, `--config <path>`, `--log-level`,
   `--memory-path`; parsed by `src/cli/` and handed in as a
   `Partial<ArgentConfig>`.
2. **Env vars** — `ARGENT_MODE`, `ARGENT_LOG_LEVEL`, `ARGENT_MEMORY_PATH`,
   `ARGENT_CONFIG_PATH`, `ARGENT_SATELLITE_SECRET`, plus provider keys
   (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_HOST`) already
   consumed by `src/auth/env-backend.ts` and `src/providers/`.
3. **Config file** — JSON at `~/.argent-lite/config.json` (override via
   `--config` / `ARGENT_CONFIG_PATH`). Missing = ok; malformed = error.
4. **Defaults** — baked into the loader, see §2.

`resolveConfig` is a pure function of `(cliPartial, env, fileContents)`.
No fs or `process.env` reads inside the resolver — caller passes them
in. This is what makes tests deterministic (§6).

## 2. Schema (fields needed today)

```ts
// src/config/types.ts
export interface ArgentConfig {
  mode: RuntimeMode;                  // from src/config/mode.ts
  logLevel: "debug" | "info" | "warn" | "error";
  memoryPath: string;                 // absolute path to sqlite file
  providers: {
    ollama?:    { host: string; model: string };
    anthropic?: { model: string };    // secret via CredentialStore
    openai?:    { model: string };
    hailo?:     { enabled: boolean };
  };
  channels: {
    cliStdio?:  { enabled: boolean };
    http?:      { enabled: boolean; host: string; port: number };
    fileWatch?: { enabled: boolean; path: string };
  };
  satellite?: { endpoint: string; secretRef: "env:ARGENT_SATELLITE_SECRET" | "file" };
}
```

Defaults: `mode=standalone`, `logLevel=info`,
`memoryPath=~/.argent-lite/memory.sqlite`,
`providers.ollama={host:"http://127.0.0.1:11434",model:"gemma3:1b"}`,
`channels.cliStdio.enabled=true`.

Secrets are **never** stored in `ArgentConfig`. Config holds *references*
(`secretRef`); the existing `CredentialStore` in `src/auth/` resolves
them, preserving the AES-256-GCM file backend from `provider-auth`.

## 3. Validation policy

- Strict parse. Unknown top-level keys → `InvalidConfigError` naming
  the offending key path.
- No silent coercion. `"true"` is not `true`; `"3000"` is not `3000`.
  Env-var ingestion uses typed parsing with explicit failure messages,
  mirroring `loadMode()`'s `InvalidRuntimeModeError` style.
- Enum fields (`mode`, `logLevel`) reject anything outside the literal
  union and list allowed values in the error.
- Path fields: non-empty strings; `~` expansion happens at the call
  site, not the loader, to keep the loader pure.
- Required after merge: `mode`, `logLevel`, `memoryPath`. Everything
  else optional, defaults-filled.
- Hand-rolled checker — no Zod. Phase 1 stays dependency-free and
  matches the existing pattern in `src/config/mode.ts`.

## 4. Candidate file layout

```
src/config/
  mode.ts    # existing — unchanged
  loader.ts  # NEW — resolveConfig() + validateConfig() + DEFAULT_CONFIG
  types.ts   # NEW — ArgentConfig + error classes
  index.ts   # NEW — re-exports loadMode + resolveConfig
```

## 5. Interaction with `loadMode()`

`loadMode()` stays the lowest-level primitive. `resolveConfig()` calls
`loadMode(env)` for the `mode` field so there is exactly one parser for
it; CLI `--mode`, when present in the partial, wins over it. No
behavioral change to existing callers of `loadMode()`. Migrating
`bootRuntime()` (phase3-runtime-slice) from `loadMode()` to
`resolveConfig()` is a **follow-on slice**, not this one.

## 6. Test strategy

- Deterministic inputs. Tests build `env` as plain `Record<string,string>`,
  never touch `process.env` or the real fs. Config-file contents passed
  as strings and parsed in-memory.
- Fixture table `(cli, env, file) → expected ArgentConfig | error`:
  one row per precedence rule (§1), one per validation rule (§3).
  ~20 rows, mirroring `test/config/mode.test.ts`.
- Error-path tests assert exact error class and that the message names
  the offending key. Exact-equal on resolved object; no snapshots.

## 7. Open questions

1. **File format** — JSON (zero-dep) vs TOML/YAML (friendlier, new dep).
2. **Secret indirection grammar** — `env:NAME` / `file:PATH` enough, or
   full URI scheme? Current auth code only needs those two.
3. **Memory-path default** — confirm with `memory-store-impl` owner.
4. **Satellite block** — require at load time in satellite mode, or
   fail later at transport start? Leaning "require at load time."
5. **Hot reload** — out of scope for Phase 1. Flagging so it isn't
   designed in by accident.

**Non-goals:** hot reload; per-agent overrides; remote fetch; schema
migration tooling.
