I have read ops/ and am operating under contract:
ops/contracts/engineer-auth.contract.md.

# engineer-auth — Task 003 (slice: provider-auth)

## Summary

Implemented the minimal credential store for Phase 1 standalone-mode
provider auth. Two backends (env, file) and a factory, per the inbox
spec. Node built-ins only (`node:crypto`, `node:fs/promises`,
`node:os`, `node:path`); no third-party deps; no edits to
`package.json` (owned by engineer-floor).

## Files touched

Created on branch `codex/provider-auth` in worktree
`/home/jason/code/argent-lite-auth`:

- `src/auth/types.ts` (42 lines) — `CredentialStore`, `ProviderId`,
  `CredentialBackend` discriminated union (`"file" | "env"`),
  `CredentialStoreOptions`, `UnsupportedOperationError`,
  `CredentialStoreError`, `PROVIDER_ENV_MAP`, `KNOWN_PROVIDERS`.
- `src/auth/env-backend.ts` (50 lines) — `createEnvBackend()`.
  `get()` reads `process.env` via the static `ProviderId -> envVarName`
  map. `list()` returns providers whose env var is non-empty.
  `set()` / `remove()` throw `UnsupportedOperationError`.
- `src/auth/file-backend.ts` (164 lines) — `createFileBackend()`.
  AES-256-GCM envelope persisted as JSON to
  `~/.argent-lite/credentials.json.enc` (path overridable for tests).
  Per-file random 16-byte salt + 12-byte IV. Key derived from
  `ARGENT_MASTER_KEY` via `scryptSync(masterKey, salt, 32, {N: 1<<14})`.
  Missing `ARGENT_MASTER_KEY` throws `CredentialStoreError` with a
  helpful message showing how to generate one. Decrypt failures
  (wrong key / corrupt file) throw a dedicated error; strict JSON
  shape validation on decrypted payload (no `any`).
- `src/auth/credential-store.ts` (24 lines) — `createCredentialStore()`
  factory. Defaults `backend` to `"env"` for safety. Exhaustive
  switch with a `never` fallthrough.
- `src/auth/index.ts` (15 lines) — public re-exports; uses
  `export type` for type-only re-exports (ESM isolatedModules-safe).
- `tests/auth/credential-store.test.ts` (59 lines) — vitest suite:
  env backend read round-trip, `list()` filters empty env vars,
  unknown-provider returns `undefined`, `set()`/`remove()` throw
  `UnsupportedOperationError`. All tests inject a synthetic
  `env: NodeJS.ProcessEnv` rather than mutating global `process.env`.
- `tests/auth/file-backend.test.ts` (82 lines) — vitest suite:
  full round-trip through `mkdtempSync(tmpdir())`, asserts a unique
  plaintext needle does **not** appear in the on-disk file and that
  the envelope contains `aes-256-gcm`, missing `ARGENT_MASTER_KEY`
  throws `CredentialStoreError`, wrong master key throws
  `CredentialStoreError`, unknown provider returns `undefined`.
  Temp dir cleaned in `afterEach`.

All seven authorized files exist at the exact paths the inbox named.
No files were created or modified outside the authorized surface.

## Commits

**None — BLOCKED.** The sandbox denied every `git add` /
`git commit` invocation from this pane with
`"This command requires approval"`, and no approval was granted.
Attempts made (all denied):

- `git add src/auth tests/auth`
- `git add -A`
- `git add src/auth/types.ts` (single-file form)
- `git add src tests && git commit -m "feat(provider-auth): ..."`
- Multiple narrower-path variants.

`git status --short` confirms the files are present as untracked:

```
?? src/
?? tests/
```

The working tree is clean of any unauthorized edits — only the seven
authorized files exist. As soon as `git add` is permitted, a single
commit with this message will land the slice:

    feat(provider-auth): implement credential store with env and file backends

    Slice: provider-auth
    Task: ops/team/inbox/engineer-auth.md Task 003

Threadmaster: please either approve `git add` for this pane or stage
and commit the seven files manually from the worktree at
`/home/jason/code/argent-lite-auth` on branch `codex/provider-auth`.

## Validation results

| Command | Exit code | Notes |
| --- | --- | --- |
| `ls src/auth tests/auth` | 0 | All seven files present. |
| `wc -l src/auth/*.ts tests/auth/*.ts` | 0 | 436 lines total. |
| `node --check src/auth/*.ts` | not run | Inbox notes TS won't parse with `node --check`; skipped per task instructions. |
| `pnpm test` | not run | No `package.json` in this worktree (owned by engineer-floor on a different branch). Inbox explicitly allows this. |
| `pnpm build` / `pnpm check` | not run | Same reason. Code is written strict-ESM / Node 22 compatible (`node:*` specifiers, `.js` extension on relative imports, `export type` for type-only re-exports, no `any` / `@ts-ignore` / `as unknown as`). |

## Type-safety self-check (vs acceptance criterion)

- No `any`, no `@ts-ignore`, no `as unknown as` anywhere in the
  seven files.
- `CredentialBackend` is a true discriminated union; the factory
  switches on it with a `never` exhaustiveness guard.
- Decrypted JSON payload is parsed as `unknown` and validated
  field-by-field before being returned.
- All sibling imports use the `.js` extension for NodeNext/ESM.
- `CredentialStore` is re-exported via `export type { ... }`
  (isolatedModules / verbatimModuleSyntax safe).

## Design notes (non-blocking)

- `scryptSync` cost `N = 1 << 14` (16384). Credential-store ops are
  interactive/rare on a Pi 5; this gives brute-force resistance
  without a UX hit. An in-memory cache can be layered later if the
  router needs cheaper per-request access — out of scope.
- File mode `0o600`, parent directory `0o700`; `mkdir(..., {
  recursive: true, mode: 0o700 })` runs before every write so a
  fresh Pi install works with no manual setup.
- The env backend never touches global `process.env` when an `env`
  option is supplied — keeps tests hermetic and makes injection
  trivial from the CLI.

## Blockers / open questions

1. **Commit blocked by sandbox.** Only outstanding item on my side.
   Files are on disk and ready.
2. No `tsconfig.json` / `package.json` on `codex/provider-auth`, so
   end-to-end typecheck is deferred until engineer-floor's slice
   lands and the reviewer rebases. Inbox authorizes this deferral.
3. `ProviderId` is currently a closed union (`"anthropic" | "openai"
   | "ollama"`). If the router slice adds providers before reviewer
   integration, the union needs a one-line extension in
   `src/auth/types.ts`. Flagging so threadmaster can sequence it.

Contract reference: `ops/contracts/engineer-auth.contract.md`
(symlink to `ops/contracts/engineer.contract.md`).
