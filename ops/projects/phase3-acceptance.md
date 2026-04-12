---
name: phase3-acceptance
description: Phase 3 done-definition — what ships, what's missing, acceptance test, sign-off
type: project
---

# Phase 3 Acceptance — Done Definition

**Slice:** `phase3-acceptance` · **Owner:** architect ·
**Parents:** `phase3-integration-plan.md`, `memory-lite-design.md`,
`channels-lite-design.md`, `agent-lifecycle-design.md`,
`intent-routing-design.md`, `observability-design.md`.

## 1. Intent

Phase 3 is done when a single process can receive a prompt on a
channel, classify it to an agent via intent, route the request through
the model router, persist both sides to the memory store, and expose
structured logs + metrics — and the operator can reproduce that end-to-end
flow from a clean checkout with one command.

## 2. SHIPPED (merged on `codex/ops-team-bootstrap`)

| Piece | PR | Notes |
| --- | --- | --- |
| memory-lite-design (gate) | #17 | design only |
| `SqliteMemoryStore` (`src/memory`) | #21 | `node:sqlite`, append/query |
| `withRetention` wrapper | #23 | TTL + event cap |
| channels-lite-design (gate) | #20 | design only |
| `CliStdioChannel` | #22 | injected stdin/stdout |
| `HttpChannel` (POST /v1/prompt) | #32 | bearer via satellite auth |
| `RouterAgent` over `MessageBus` | #18 | message-driven |
| `router-agent-live` (e2e runner) | #24 | `src/demo/e2e-runner.ts` |
| phase3-integration-plan (gate) | #25 | §3 is the runtime seam |
| observability-design (gate) | #29 | local-only obs |
| `createLogger` (`src/obs/logger.ts`) | #27 | structured JSON |
| `createMetrics` (`src/obs/metrics.ts`) | #26 | counters + ring histograms |
| `instrumentRouter` wrapper | #28 | metrics + logs on route |
| `agent-trace-context` helpers | #30 | trace id plumbing |
| `satellite-auth-hardening` (HMAC+bearer) | #31 | `requireAuth` |
| intent-routing-design (gate) | #33 | `IntentRouter` contract |

Cycle-10 integration: **163/163 tests green**, `pnpm check`/`build` clean.

## 3. MISSING before Phase 3 can close

Structural seams still absent in `main`:

1. **`AgentContext.memory`** — still optional-by-absence. `src/agents/agent-context.ts` does not carry a `MemoryStore`. Phase3 plan §5(2) requires this be non-optional.
2. **`bootRuntime()`** — `src/integration/` is README-only. No single constructor wires memory + router + channel + scheduler. Plan §3.
3. **`argent chat` subcommand** — `src/cli/index.ts` is still the one-shot Phase 1 router. No channel-driven loop.
4. **Intent router implementation** — design merged (#33), impl in flight on `codex/intent-router-impl` (cycle-11). Phase 3 cannot be "complete" without the dispatcher actually running between channel and agent.
5. **Memory-observed router** — `withMemoryLog(inner, memory)` wrapper in flight on `codex/memory-observed-router` (cycle-11). Required so `router.route` emits `router.out` events the smoke test greps.
6. **Instrumented CLI entrypoint** — `src/cli/instrumented-main.ts` in flight on `codex/instrumented-cli` (cycle-11). Required so metrics/logger are actually on the hot path, not just unit-tested in isolation.
7. **SIGINT teardown order** — no test asserts `channel.stop() → scheduler.stop() → memory.close()` with zero leaked handles. Plan §5(5).
8. **Event-kind vocabulary locked** — `channel.in`, `channel.out`, `router.in`, `router.out`, `agent.error` must be the only kinds written by the runtime seam. Not enforced anywhere yet.

## 4. Acceptance smoke test (the one-liner)

From a clean checkout, with ollama reachable on localhost:11434:

```
pnpm install && pnpm build && ARGENT_HOME=$(mktemp -d) ARGENT_PROVIDERS=ollama \
  bash -c 'echo "hello, who are you?" | node dist/cli/index.js chat && \
           node -e "const s=require(\"node:sqlite\");const db=new s.DatabaseSync(process.env.ARGENT_HOME+\"/memory.sqlite\");console.log(db.prepare(\"select kind,count(*) c from events group by kind\").all())"'
```

**Pass =** (a) a non-empty reply frame prints on stdout; (b) the final
JSON row set contains at least one `channel.in` and one `router.out`;
(c) process exits 0 on EOF with no dangling handle warning.

Unit-test equivalent (CI, no ollama): `tests/integration/cli-chat.test.ts`
drives a fake `Readable`, injects a stub provider, asserts the same two
event kinds plus `process._getActiveHandles().length === 0` after stop.

## 5. Remaining sub-slices (dependency order)

1. **`intent-router-impl`** — `src/intents/{types,router,index}.ts`. No deps. *(in flight cycle-11)*
2. **`memory-observed-router`** — `src/router/memory-router.ts`. Depends on existing `MemoryStore`. *(in flight cycle-11)*
3. **`instrumented-cli`** — `src/cli/instrumented-main.ts`. Depends on obs + router only. *(in flight cycle-11)*
4. **`agent-context-memory`** — add `memory: MemoryStore` to `AgentContext`, update all construction sites. Blocks #5.
5. **`phase3-runtime-slice`** — `src/integration/runtime.ts` + `argent chat` subcommand + SIGINT teardown test. Consumes #1–#4.
6. **`intent-chat-handler`** — register a `chat.prompt` intent that targets `RouterAgent`; wire `IntentRouter` into the channel-in subscription inside `bootRuntime()`.
7. **`phase3-e2e-test`** — `tests/integration/cli-chat.test.ts` (stub provider) + nightly Pi job that runs the §4 one-liner against real ollama.

Parallelizable after #5 lands (not blockers for the gate):
`channel-file-watch`, `memory-telemetry`, richer intent strategies
(keyword / LLM), HTTP channel auth rotation.

## 6. Time estimate

- Cycle-11 (in flight): finishes #1, #2, #3 — ~1 cycle.
- Cycle-12: #4 + #5 in one engineer-auth slice — ~1 cycle.
- Cycle-13: #6 + #7 + integration pass — ~1 cycle.

**Total to Phase 3 close: ~3 cycles** assuming no scope drift and
ollama stays reachable on the Pi. Hailo-10H arrival 2026-04-12 is
orthogonal; Phase 3 does not depend on it.

## 7. Operator sign-off criteria

The operator marks Phase 3 complete when all of the following are
true on `main` (or the designated release branch):

1. `pnpm install && pnpm check && pnpm test && pnpm build` — all exit 0.
2. The §4 one-liner runs green on the Pi against real ollama and prints
   a non-empty reply.
3. `memory.sqlite` after the smoke run contains rows for both
   `channel.in` and `router.out`, and no rows with kinds outside the
   locked vocabulary (§3.8).
4. `argent chat` exits cleanly on Ctrl-C; no leaked-handle warning.
5. `src/integration/runtime.ts` is the *only* place in the codebase
   that constructs a `MemoryStore`, a `ModelRouter`, or a channel at
   runtime (grep check).
6. REGISTRY + ACTIVE + JOURNAL updated; PR body links this doc.

## 8. Risks / non-goals

- **Not in Phase 3:** satellite-mode runtime wiring, multi-agent
  fan-out, LLM-based intent strategy, retention telemetry dashboards,
  Hailo provider beyond the existing stub.
- **Risk:** `AgentContext.memory` change is a small but fan-out edit
  (every agent construction site). Keep it in one slice to avoid merge
  churn.
- **Risk:** locking the event-kind vocabulary late means retention +
  telemetry indexes may need rework. Lock it in `phase3-runtime-slice`.
