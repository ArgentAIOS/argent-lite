# Task 003 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md (symlink to engineer.contract.md)
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: provider-auth
Branch: codex/provider-auth (in worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/auth/index.ts                         (create)
- src/auth/credential-store.ts              (create)
- src/auth/file-backend.ts                  (create)
- src/auth/env-backend.ts                   (create)
- src/auth/types.ts                         (create)
- tests/auth/credential-store.test.ts       (create)
- tests/auth/file-backend.test.ts           (create)

## Context

Operator approved Phase 1 on 2026-04-11. Standalone mode requires a
credential store that can hold API keys for cloud providers (Anthropic,
OpenAI, Ollama local). The store is greenfield — nothing to port from
argentos-core. Design it for a Pi with no TPM and no system keyring
daemon. Support two backends: encrypted file at
`~/.argent-lite/credentials.json.enc` and env-var passthrough
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.).

## Goal

Implement a minimal credential store with the following shape:

```ts
export interface CredentialStore {
  get(providerId: string): Promise<string | undefined>;
  set(providerId: string, secret: string): Promise<void>;
  list(): Promise<string[]>;
  remove(providerId: string): Promise<void>;
}
```

1. `src/auth/types.ts` — exports `CredentialStore`, `ProviderId`, and a
   `CredentialBackend` discriminated union (`"file" | "env"`).
2. `src/auth/env-backend.ts` — reads from `process.env` using a static
   map `ProviderId -> EnvVarName`. `set`/`remove` throw
   `UnsupportedOperationError` (env vars are read-only at runtime).
3. `src/auth/file-backend.ts` — AES-256-GCM encrypted JSON file at
   `~/.argent-lite/credentials.json.enc`. Master key comes from
   `ARGENT_MASTER_KEY` env var; if missing, throw a helpful error
   explaining how to set it. Use only Node's built-in `crypto`. No
   third-party deps.
4. `src/auth/credential-store.ts` — factory `createCredentialStore(opts)`
   that returns a `CredentialStore` backed by the chosen backend.
   Defaults to `env` for safety.
5. `src/auth/index.ts` — re-exports the public surface.
6. Tests (vitest):
   - `credential-store.test.ts`: creates a store, round-trips a value,
     lists providers, removes one. Uses env backend with mocked
     `process.env`.
   - `file-backend.test.ts`: round-trips through a temp file in
     `os.tmpdir()`, verifies the file on disk is not plaintext (grep
     for the secret string should not find it), and confirms a wrong
     master key throws.

## Constraints

- Node built-ins only. No new dependencies in `package.json`. The
  `package.json` is owned by engineer-floor on a different branch; you
  cannot edit it.
- All code must typecheck under the `tsconfig.json` that engineer-floor
  produces (strict, ESM, Node 22). If your branch doesn't have
  `tsconfig.json` yet, write the code to be strict-compatible anyway;
  the reviewer will validate after integration.
- Do not touch `src/router/`, `src/providers/`, `src/cli/`, or
  `src/config/` — those are other engineers' slices.

## Acceptance criterion

- All seven files exist at the paths above.
- Type-safe: no `any`, no `@ts-ignore`, no `as unknown as`.
- Tests are written and runnable (you don't need pnpm test to succeed
  on your branch if engineer-floor hasn't landed yet — but the tests
  must be syntactically valid and free of obvious logic errors).
- `ops/team/outbox/engineer-auth.md` contains confirmation line, files
  touched, commits (SHAs), and a note on whether tests were run.

## Validation commands

- `node --check src/auth/*.ts 2>&1 || true` — TS files won't parse with
  `node --check`; instead run `ls` to confirm existence and count lines.
- `wc -l src/auth/*.ts tests/auth/*.ts` — report line counts.
- If `package.json` exists in your worktree (after rebase): `pnpm test`.

## Deadline

Before the next operator check-in (target: 30–45 minutes).
