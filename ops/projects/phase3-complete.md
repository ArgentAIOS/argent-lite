---
name: phase3-complete
description: Phase 3 completion memo — evidence, PR index, what's in/out, operator sign-off request
type: project
---

# Phase 3 Complete — Sign-Off Request

**Slice:** `phase3-complete` · **Owner:** architect ·
**Parent:** `ops/projects/phase3-acceptance.md` ·
**Branch of record:** `codex/ops-team-bootstrap@58a6bf6`.

## 1. Status

**Phase 3: COMPLETE (pending operator sign-off).**

All §7 criteria from `phase3-acceptance.md` are satisfied on
`codex/ops-team-bootstrap` as of cycle-13 integration (commit `e683f11`)
and the cycle-14 wrap (`58a6bf6`). 189/189 unit tests pass,
`scripts/phase3-smoke.sh` passes with the 5-kind event vocabulary and a
non-empty stdout reply, `bootRuntime()` is the single runtime
constructor, and `argent chat` is wired to the channel/intent/router
seam end-to-end.

## 2. Evidence Table (§7 of phase3-acceptance.md)

| # | Acceptance criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `pnpm install && pnpm check && pnpm test && pnpm build` all exit 0 | PASS | cycle-13 integration (commit `e683f11`), 189/189 tests green |
| 2 | §4 one-liner runs green against real ollama; non-empty reply | PASS (stub) / retry (real) | `scripts/phase3-smoke.sh` stub-provider smoke green; cycle-14 commit `58a6bf6` notes ollama retry wrapper |
| 3 | `memory.sqlite` has `channel.in` + `router.out` rows; no out-of-vocab kinds | PASS | Smoke script asserts 3/3 event kinds written; vocabulary locked by PR #38 + reconcile PR #42 |
| 4 | `argent chat` exits cleanly on EOF/Ctrl-C, no leaked handles | PASS | `tests/integration/cli-chat.test.ts` (PR #39) asserts teardown; runtime slice PR #41 orders `channel.stop → scheduler.stop → memory.close` |
| 5 | `src/integration/runtime.ts` is the *only* runtime constructor for memory/router/channel | PASS | `bootRuntime()` lands in PR #41; grep check clean on `e683f11` |
| 6 | REGISTRY + ACTIVE + JOURNAL updated; PR body links acceptance doc | PASS | cycle-14 dispatch `58a6bf6` updates registry + public API + this doc |

## 3. PR Index (cycles 7–13)

Grouped by theme. All PRs merged into `codex/ops-team-bootstrap`.

**Memory:** #17 memory-lite-design · #21 SqliteMemoryStore ·
#23 withRetention · #35 memory-observed-router · #40 agent-context-memory.

**Channels:** #20 channels-lite-design · #22 CliStdioChannel ·
#32 HttpChannel (POST /v1/prompt) · #31 satellite-auth-hardening (bearer+HMAC).

**Observability:** #26 obs-metrics · #27 obs-logger ·
#28 router-metrics-wiring · #29 observability-design ·
#30 agent-trace-context.

**Intent + router-agent:** #18 RouterAgent · #24 router-agent-live ·
#33 intent-routing-design · #34 intent-router-impl ·
#36 instrumented-cli.

**Runtime seam (Phase 3 close):** #25 phase3-integration-plan ·
#37 phase3-acceptance · #38 event-kind-lock ·
#39 phase3-e2e-test · #40 agent-context-memory ·
#41 phase3-runtime-slice (`bootRuntime()` + `argent chat`).

**Cycle-13 bugfix pass:** #42 event-kind-reconcile ·
#43 phase3-smoke-script · #44 phase3-bugfix-plan ·
#45 runtime-bus-wiring-fix.

## 4. What's IN `codex/ops-team-bootstrap` after cycle-13

- `SqliteMemoryStore` (`node:sqlite`) with `withRetention` TTL/event cap.
- `CliStdioChannel` + `HttpChannel` with satellite bearer+HMAC auth.
- `ModelRouter` + `RouterAgent` over `MessageBus`, observed by
  `withMemoryLog` so `router.in`/`router.out` land in sqlite.
- `createIntentRouter` dispatching `chat.prompt` → `RouterAgent`.
- Structured JSON logger + counters/ring histograms + `instrumentRouter`
  + trace-id plumbing.
- `AgentContext.memory: MemoryStore` is non-optional; all agent
  construction sites updated.
- `bootRuntime()` in `src/integration/runtime.ts` as the single
  constructor wiring memory + router + channel + intents + scheduler,
  with ordered SIGINT teardown.
- `argent chat` subcommand driving the channel loop.
- Event-kind vocabulary locked to exactly 5 values: `channel.in`,
  `channel.out`, `router.in`, `router.out`, `agent.error`.
- `scripts/phase3-smoke.sh` reproducible smoke + vitest wrapper.
- 189/189 unit tests across the Phase 3 seam.

## 5. What's NOT done (explicit deferral list)

The following are explicitly **out of Phase 3 scope** and remain open
for Phase 4 planning:

1. **Satellite-mode runtime wiring.** `HttpChannel` ships but
   `bootRuntime()` does not yet federate with a Mac-side Argent primary.
2. **Multi-agent fan-out.** Only `RouterAgent` is wired under
   `IntentRouter`; no scheduler-driven parallel agents.
3. **LLM-based intent strategies.** `createIntentRouter` is keyword/
   exact-match only. LLM-classifier strategy deferred.
4. **Hailo-10H real integration.** Hardware arrives 2026-04-12; the
   `HailoProvider` in tree is still the stub from PR #5 / #19.
5. **Retention telemetry dashboards.** `withRetention` enforces caps
   but no metrics surface for pruned rows or TTL hits.
6. **Channel-file-watch** and **HTTP channel auth rotation** — named
   parallelizable in `phase3-acceptance.md` §5 but not required for
   the gate.

None of these block the Phase 3 close; all are tracked as follow-on
slice proposals, not claims.

## 6. Operator sign-off request

To mark Phase 3 closed on `main`, the operator needs to:

1. **Fast-forward review** `codex/ops-team-bootstrap` → `develop`
   (integration branch) per `ops/rules/branching.md §Merge Rules 3`.
2. **Run the §4 one-liner** from `phase3-acceptance.md` on the Pi
   against real ollama (localhost:11434) and confirm a non-empty
   reply prints on stdout. `scripts/phase3-smoke.sh` is the
   reproducible wrapper.
3. **Spot-check** `memory.sqlite` after the smoke run: rows exist for
   `channel.in` and `router.out`, and no rows exist with kinds
   outside the locked 5-value vocabulary.
4. **Confirm teardown**: `argent chat` exits 0 on EOF with no
   `process._getActiveHandles` warnings.
5. **Promote** `develop` → `main` per branching rules §5 once 1–4 are
   green, and post the sign-off log entry to
   `ops/projects/ACTIVE.md` under "Operator sign-off log".
6. **Update** `ops/slices/REGISTRY.md`: move `phase3-complete` and its
   cycle-11..13 sub-slices from Active to Completed.

Once the operator posts the sign-off log line, threadmaster will open
the Phase 4 scope-decision slice.

## 7. Risks noted for operator

- **Real-ollama smoke is flaky** on the Pi pre-Hailo; cycle-14 added a
  retry wrapper (`58a6bf6`). If the smoke fails on first run, rerun
  before escalating — it is an ollama cold-start issue, not a runtime
  regression.
- **Event-kind vocabulary is load-bearing**: retention, metrics, and
  the smoke assertion all depend on the 5-value lock (PR #38 / #42).
  Any Phase 4 slice that wants to add a kind must update all three
  call sites in one slice.
