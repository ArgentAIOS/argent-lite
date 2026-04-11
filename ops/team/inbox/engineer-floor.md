# Task 003 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md (symlink to engineer.contract.md)
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: project-floor
Branch: codex/project-floor (in worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- package.json                  (create)
- pnpm-workspace.yaml           (create, minimal)
- tsconfig.json                 (create)
- vitest.config.ts              (create)
- .eslintrc.cjs                 (create, minimal)
- .prettierrc.json              (create, minimal)
- .gitignore                    (add node_modules, dist, coverage)
- src/index.ts                  (create — library entrypoint, exports public API surface placeholders)
- tests/smoke.test.ts           (create — sanity test that vitest runs)

## Context

Operator approved Phase 1 on 2026-04-11. The repo is greenfield: no
`package.json`, no tooling. Your job is to lay the project floor so the
other engineers can build and test their slices.

## Goal

1. Initialize a TypeScript + Node 22 project with pnpm:
   - `name`: `@argentaios/argent-lite`
   - `private`: true
   - `type`: `"module"`
   - `packageManager`: `pnpm@10.33.0`
   - `scripts`: `build` (tsc), `test` (vitest run), `test:watch`,
     `check` (tsc --noEmit), `lint` (eslint), `format` (prettier -w),
     `start` (node --loader tsx/esm src/cli/index.ts)
   - `dependencies`: none yet (engineers add their own on their slices).
   - `devDependencies`: typescript ^5.6, vitest ^2.1, @types/node ^22,
     tsx ^4.19, eslint ^9, @typescript-eslint/eslint-plugin ^8,
     @typescript-eslint/parser ^8, prettier ^3.3
2. `tsconfig.json`: strict, ESM, Node 22 target, moduleResolution `bundler`,
   rootDir `.`, outDir `dist`, include `src/**/*`, `tests/**/*`.
3. `vitest.config.ts`: ESM-friendly, globals enabled, include `tests/**/*.test.ts`.
4. `src/index.ts`: re-exports stub for public API. Create an empty
   `export {}` statement and a header comment explaining this is the
   library entrypoint for Argent Lite.
5. `tests/smoke.test.ts`: imports `src/index.ts`, asserts `true === true`.
   Must pass under `pnpm test`.
6. Run the validation commands below and report real exit codes.

## Acceptance criterion

- `pnpm install` completes without network errors.
- `pnpm check` passes (exit 0).
- `pnpm test` passes with at least one test (exit 0).
- `pnpm build` produces a `dist/` folder (exit 0).
- `ops/team/outbox/engineer-floor.md` has the confirmation line, files
  touched, commits (short SHAs), and every validation command with its
  real exit code.

## Validation commands

- `pnpm install`                    — expect 0
- `pnpm check`                      — expect 0
- `pnpm test`                       — expect 0
- `pnpm build`                      — expect 0
- `pnpm lint`                       — expect 0 or 1; report real code

If `pnpm install` fails due to offline registry, try `pnpm install
--prefer-offline`. If it still fails, report BLOCKED with the real
network error and stop — do not hand-write node_modules.

## Deadline

Before the next operator check-in (target: 30–45 minutes). Other
engineers are blocked on your `package.json` and `tsconfig.json`; this
slice is the critical path.
