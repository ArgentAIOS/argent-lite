# Task 003 — architect

Contract: ops/contracts/architect.contract.md
Runbooks: ops/runbooks/research-planning.md, ops/runbooks/slice-management.md
Slice: cli-scaffold (design-with-authorized-scaffold)
Branch: codex/cli-scaffold (in worktree /home/jason/code/argent-lite-cli)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/phase1-design.md            (create)
- src/cli/README.md                         (create — design doc only, no code)
- src/config/README.md                      (create — design doc only, no code)
- src/cli/index.ts                          (create — thin entrypoint ≤60 lines)
- src/config/mode.ts                        (create — runtime mode type + loader ≤80 lines)
- tests/cli/smoke.test.ts                   (create — boot smoke test)

## Context

Operator approved Phase 1 of the scope decision on 2026-04-11. Phase 1
ships a headless CLI that accepts a prompt, routes it through the model
router, and returns a response. Two runtime modes (satellite, standalone)
are config-driven. The other engineers are implementing the router and
auth in parallel; your job is the glue: the CLI entrypoint and the
runtime mode config — plus a one-page design doc that ties Phase 1
interfaces together.

## Goal

1. Write `ops/projects/phase1-design.md` — one page, covering:
   - The four public interfaces (Router, Provider, CredentialStore, CliCommand)
     as TypeScript-ish signatures. No implementation, just shape.
   - How satellite vs standalone modes differ at the config level.
   - The wiring diagram: CLI → Router → Provider (local | cloud).
   - Acceptance criteria Phase 1 must meet before merge.
2. Create `src/cli/index.ts` — a thin `main()` that parses argv, loads
   runtime mode, constructs router (import from `src/router`), sends the
   prompt, prints response, exits 0. ≤60 lines. Import-only; the router
   and providers are implemented by other engineers on parallel branches
   and will merge later. Use type imports only where needed; guard the
   router import so `pnpm test` passes even if `src/router` is a stub.
3. Create `src/config/mode.ts` — exports a `RuntimeMode` union
   (`"satellite" | "standalone"`) and a `loadMode()` function that reads
   `ARGENT_MODE` env var (default `"standalone"`) and validates. ≤80 lines.
4. Create `src/cli/README.md` and `src/config/README.md` — one paragraph
   each describing the module's role and its public surface.
5. Create `tests/cli/smoke.test.ts` — imports `loadMode` and asserts
   default is `"standalone"` and that `"satellite"` round-trips. Must
   pass under vitest.

## Acceptance criterion

- `ops/projects/phase1-design.md` exists and is one page (~150 lines max).
- `src/cli/index.ts`, `src/config/mode.ts` exist and typecheck under the
  `tsconfig.json` that engineer-floor is producing on `codex/project-floor`.
- `tests/cli/smoke.test.ts` passes when run via `pnpm test` after
  project-floor lands.
- `ops/team/outbox/architect.md` has the confirmation line and standard
  output shape.
- No files touched outside the authorized surface.

## Coordination

- engineer-floor owns `package.json`, `tsconfig.json`, `vitest.config.ts`.
  Your test file will be executed by their config.
- engineer-auth owns `src/auth/**`.
- engineer-router owns `src/router/**` and `src/providers/**`.
- If your CLI needs a router import, use a type-only import or a dynamic
  import guarded behind a try/catch so your branch builds standalone.

## Validation commands

- `ls src/cli/index.ts src/config/mode.ts ops/projects/phase1-design.md`
- `wc -l src/cli/index.ts src/config/mode.ts` (report the counts)

Do not run `pnpm test` — that is engineer-floor and reviewer's job after
integration.

## Deadline

Before the next operator check-in (target: 30–45 minutes).
