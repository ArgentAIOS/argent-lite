I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary

Delivered `ops/projects/config-loader-design.md` (118 lines): a
shape-only memo for a pure `resolveConfig(cliPartial, env, fileContents)`
loader layered on top of the existing `loadMode()` primitive, with
CLI > env > `~/.argent-lite/config.json` > defaults precedence, strict
no-coerce validation, and secrets held by reference (`CredentialStore`)
rather than in `ArgentConfig`.

## Rationale

- Precedence order matches the task goal in `ops/team/inbox/architect.md`
  §1 and keeps CLI ergonomics on top, env for deployment, file for
  persistence.
- Pure-function design (no fs / no `process.env` reads inside the
  resolver) is the precondition for the deterministic test strategy
  required by inbox §6 and mirrors the fixture-table pattern already
  used by `src/config/mode.ts`.
- Secrets-by-reference preserves the AES-256-GCM file backend shipped
  in the completed `provider-auth` slice (REGISTRY row) — designing a
  second secret path would fork the auth story.
- Non-breaking wrt `src/config/mode.ts`: `resolveConfig` *calls*
  `loadMode(env)` for the `mode` field so parsing stays single-sourced;
  existing callers of `loadMode()` are unchanged.
- Migration of `bootRuntime()` to `resolveConfig` is explicitly deferred
  to a follow-on slice, consistent with `ops/rules/never-do.md`
  ("never mix unrelated repo changes into one handoff packet").
- No Zod / new dep: matches `src/config/mode.ts`'s hand-rolled checker
  and the zero-runtime-dep posture established by `project-floor`.

## Risks and non-goals

- Risk: JSON vs TOML/YAML file format is left as an open question — if
  operators push back on JSON ergonomics, implementation slice will
  stall briefly.
- Risk: memory-path default assumes `memory-store-impl`'s on-disk shape;
  flagged as open question #3.
- Non-goals explicitly called out: hot reload, per-agent overrides,
  remote fetch, schema migration tooling.
- Not designed: implementation, CLI flag parser wiring, or migration of
  `bootRuntime()`. Those are downstream slices.

## Recommended follow-on slices (names only, no claims)

- `config-loader-impl` — implement `resolveConfig` + `validateConfig` +
  fixture-table tests per §6.
- `config-cli-flags` — teach `src/cli/` to emit a `Partial<ArgentConfig>`
  for `--mode`, `--config`, `--log-level`, `--memory-path`.
- `runtime-config-migration` — migrate `bootRuntime()` from `loadMode()`
  to `resolveConfig()`.
- `config-file-format-decision` — short architect memo resolving open
  question §7.1 (JSON vs TOML/YAML).

## Files touched

- `ops/projects/config-loader-design.md` (new, 118 lines)
- `ops/team/outbox/architect.md` (this file)

## Validation

Skipped by design. Architect contract §"What the architect does NOT do"
prohibits running builds, tests, or deploys. Only markdown changed;
no source files were edited, so `pnpm test / check / build` would not
exercise anything new. No exit codes to report.

## Blockers

None. Open questions §7.1–§7.4 are for the operator / follow-on slice
owners, not blockers on this memo.
