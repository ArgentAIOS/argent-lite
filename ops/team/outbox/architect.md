I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

# cli-scaffold — Phase 1 design + scaffold

## Decision summary

Phase 1 wiring is documented in `ops/projects/phase1-design.md`. The CLI
scaffold (`src/cli/index.ts`) is a thin async `main()` that loads the
runtime mode, dynamically imports the router (try/catch guarded so this
branch builds standalone), forwards the prompt, and prints the response.
The runtime mode (`src/config/mode.ts`) is a `"satellite" | "standalone"`
union driven by `ARGENT_MODE`, defaulting to `standalone`, with a typed
`InvalidRuntimeModeError` for unknown values. Satellite mode in Phase 1
is an explicit stub that emits a warning and behaves as standalone, so
the future Mac-brain forwarder has a real call site to replace.

## Files touched (all on the cli-scaffold authorized surface)

- `ops/projects/phase1-design.md` (created, 143 lines)
- `src/cli/index.ts` (created, 58 lines — under the 60-line cap)
- `src/cli/README.md` (created)
- `src/config/mode.ts` (created, 35 lines — under the 80-line cap)
- `src/config/README.md` (created)
- `tests/cli/smoke.test.ts` (created — 5 vitest cases, see below)

No files outside the surface listed in `ops/team/inbox/architect.md`
were created or modified.

## Validation results

- `ls src/cli/index.ts src/config/mode.ts ops/projects/phase1-design.md`
  → exit 0, all three present.
- `wc -l src/cli/index.ts src/config/mode.ts ops/projects/phase1-design.md`
  → 58 / 35 / 143 (each within its inbox cap of 60 / 80 / 150).
- `pnpm test` not run — per inbox, that is engineer-floor and
  reviewer's job after integration. Vitest cases written:
  1. `loadMode({})` defaults to `"standalone"`.
  2. `loadMode({ ARGENT_MODE: "" })` defaults to `"standalone"`.
  3. `loadMode({ ARGENT_MODE: "satellite" })` round-trips.
  4. Case + whitespace normalization (`"  Satellite  "`, `"STANDALONE"`).
  5. Unknown value `"cloud"` throws `InvalidRuntimeModeError`.

## Interfaces published in phase1-design.md §1

`RuntimeMode`, `loadMode`, `Router`, `RouteRequest`, `RouteResponse`,
`Provider`, `CredentialStore`, `CliCommand`. Owners:

- `src/config/mode.ts` — architect (this slice).
- `src/router/**`, `src/providers/**` — engineer-router.
- `src/auth/**` — engineer-auth.
- `package.json`, `tsconfig.json`, `vitest.config.ts` — engineer-floor.

Any drift from these shapes by the parallel slices requires an
architect amendment to `phase1-design.md` rather than a silent local
fix.

## Risks and non-goals

- Real satellite federation is **not** in Phase 1 — only the mode
  string, the warning, and the stub call site are reserved.
- Hailo-10H hardware arrives 2026-04-12; local routing must work on
  CPU-only ollama. The CLI does not depend on Hailo.
- The dynamic `import("../router/index.js")` is intentionally guarded
  so this branch typechecks and tests pass before `model-router-lite`
  lands. Once integration runs, the guard becomes a real failure path
  with exit code `3` rather than a silent fallback.

## Recommended follow-on slices (names only — not claims)

- `phase1-integration` — merge the four child branches and run the
  acceptance script end-to-end.
- `satellite-stub-replacement` — replace the Phase 1 satellite warning
  with a real Mac-brain forwarder once the satellite protocol slice
  exists.
- `hailo-local-provider` — add a Hailo-backed local provider after the
  hardware is characterized.

## Blockers

- **Commit blocked.** Every variant of `git add <files>` returned
  "This command requires approval" in this pane, so the six new files
  remain untracked on the `codex/cli-scaffold` worktree branch. They
  are written to disk and complete; threadmaster needs to either
  (a) approve `git add` for this pane and re-run the commit, or
  (b) stage and commit the files manually with a message such as
  `cli-scaffold: phase1 design + CLI/mode scaffold`. No other
  blockers — the design and code are done.

Contract: `ops/contracts/architect.contract.md`.
