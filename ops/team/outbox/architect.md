I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary

Phase 3 wires the four already-designed pieces — `MemoryStore`, the
`Channel` interface + `cli-stdio`, `RouterAgent`, and the existing
`Scheduler`/`MessageBus` — into one runnable process via a new
`bootRuntime()` in `src/integration/runtime.ts` and a new `argent chat`
subcommand. The first runtime slice proves a single end-to-end flow
(stdin → CliStdioChannel → bus → RouterAgent → ModelRouter → ollama →
stdout) with `MemoryStore.append()` capturing both legs. Plan written
to `ops/projects/phase3-integration-plan.md` (150 lines).

## Rationale

- Dependency graph and seams come from the existing planning docs:
  `ops/projects/memory-lite-design.md` §4 (`MemoryStore` + AgentContext
  injection) and §7 (Phase 3 unblock requirements), and
  `ops/projects/channels-lite-design.md` §3–§5 (channel↔bus contract,
  `cli-stdio` as the simplest built-in).
- The plan adds **one** structural change — `AgentContext.memory` —
  matching `agent-lifecycle-design.md`'s rule that the scheduler is the
  only injector of context. No new abstractions, per
  `ops/contracts/architect.contract.md` standing guidance.
- Acceptance criteria align with `memory-lite-design.md` §10 (events
  table writeable, `query()` works) and `channels-lite-design.md` §9
  (clean SIGINT, no dangling handles).
- Open questions enumerated rather than answered (retention defaults,
  channel auth, event-kind vocabulary, provider selection,
  `bootRuntime()` location, satellite mode) so engineer slices can
  resolve them at implementation time.

## Risks and non-goals

- **Risk:** making `AgentContext.memory` non-optional touches every
  existing agent constructor; mitigated by routing the change through
  the gatekeeper `memory-store-impl` slice before the runtime slice
  opens.
- **Non-goal:** `file-watch`, `http-post`, retention sweeper,
  telemetry, multi-provider routing, satellite-mode wiring. All
  deferred to follow-on slices listed in §7 of the plan.
- **Non-goal:** answering the open questions in §6. Architect plans;
  engineers decide at implementation.

## Files touched

- `ops/projects/phase3-integration-plan.md` (new, 150 lines)
- `ops/team/outbox/architect.md` (this file)

## Validation

- `pnpm check` — exit 0 (tsc --noEmit clean)
- `pnpm test`  — exit 0, 104/104 across 23 test files
- `pnpm build` — not run (markdown-only change; no source touched)

## Recommended follow-on slices

`memory-store-impl`, `channel-core`, `channel-cli-stdio`,
`phase3-runtime-slice`, then in parallel: `memory-retention`,
`memory-telemetry`, `channel-file-watch`, `channel-http-post`.

## Blockers

None. Plan ready for threadmaster review and slice opening.
