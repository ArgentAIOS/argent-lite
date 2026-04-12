# Phase 3 Integration Plan

**Slice:** `phase3-integration-plan` · **Owner:** architect ·
**Parents:** `memory-lite-design.md`, `channels-lite-design.md`,
`agent-lifecycle-design.md`, `agent-topology-lite.md`.

## 1. Decision summary

Phase 3 wires the four already-designed pieces — `MemoryStore`, the
`Channel` interface + `cli-stdio`, `RouterAgent`, and the existing
`Scheduler`/`MessageBus` — into one runnable process. The first runtime
slice is a single end-to-end flow: a stdin line travels through
`CliStdioChannel` → `MessageBus` → `RouterAgent` → `ModelRouter` →
Ollama → reply frame → stdout, with `MemoryStore.append()` capturing
both the inbound prompt and the outbound completion. No new abstractions
ship in this slice; the goal is to prove the seams from the design docs
hold under a real request.

## 2. Dependency graph

```
        ┌──────────────┐
        │ CredentialStore │  (existing — provider-auth)
        └──────┬─────────┘
               │ inject
               ▼
   ┌───────────────────────┐
   │  ModelRouter          │  (existing)
   │  + ollama provider    │
   └──────┬────────────────┘
          │ used by
          ▼
   ┌───────────────────────┐         ┌─────────────────────┐
   │  RouterAgent          │◄────────┤  AgentContext       │
   │  (src/agents)         │         │  + ctx.router       │
   └──────┬────────────────┘         │  + ctx.memory  NEW  │
          │ pub/sub                  │  + ctx.bus          │
          ▼                          └──────┬──────────────┘
   ┌───────────────────────┐                │ injected by
   │  MessageBus           │◄───────────────┤
   │  channel:cli-stdio:in │         ┌──────┴──────────────┐
   │  channel:cli-stdio:out│         │  Scheduler          │
   └──────┬────────────────┘         │  (lifecycle owner)  │
          │ subscribed by            └─────────────────────┘
          ▼                                  ▲
   ┌───────────────────────┐                 │ start/stop
   │ CliStdioChannel       │─────────────────┘
   │ stdin → bus → stdout  │
   └──────┬────────────────┘
          │ append on each I/O
          ▼
   ┌───────────────────────┐
   │  SqliteMemoryStore    │  (new — memory-store-impl)
   │  ${ARGENT_HOME}/      │
   │  memory.sqlite        │
   └───────────────────────┘
```

Edges marked NEW are the only structural additions in Phase 3:
`AgentContext.memory` and the scheduler-side wiring that constructs
`SqliteMemoryStore` once and hands it to every agent.

## 3. First runtime slice (`phase3-runtime-slice`)

Surface (engineer-auth, single PR):

- `src/agents/agent-context.ts` — add `readonly memory: MemoryStore` to
  `AgentContext`; extend `createAgentContext` to accept it.
- `src/integration/runtime.ts` (new) — `bootRuntime()` that:
  1. loads `CredentialStore` (existing factory),
  2. constructs `ModelRouter` with the ollama provider,
  3. opens `SqliteMemoryStore`,
  4. builds one `AgentContext` (`bus`, `router`, `memory`, `abort`),
  5. registers `RouterAgent` under id `router`,
  6. starts `CliStdioChannel` bound to that bus,
  7. on SIGINT: `channel.stop()` → `scheduler.stop()` → `memory.close()`.
- `src/cli/index.ts` — add `argent chat` subcommand that calls
  `bootRuntime()` and awaits the abort signal.
- `test/integration/cli-chat.test.ts` — drives stdin via a fake
  `Readable`, asserts a reply frame on stdout, asserts two
  `memory.events` rows (`kind: "channel.in"`, `kind: "router.out"`).

The slice does not ship `file-watch`, `http-post`, retention, or
telemetry. Those are independent follow-on slices and stay
`researching` until the first runtime slice merges green.

## 4. Dogfooding / smoke test

After PR merge, the operator runs from a clean checkout:

```
pnpm install && pnpm build
ARGENT_HOME=$(mktemp -d) \
ARGENT_PROVIDERS=ollama \
node dist/cli/index.js chat
> hello, who are you?
< [router → ollama] I am ...
^C
sqlite3 $ARGENT_HOME/memory.sqlite "select kind, count(*) from events group by kind;"
```

Pass = (a) the reply prints, (b) the events table contains at least one
`channel.in` and one `router.out` row, (c) SIGINT exits cleanly with no
dangling handles (`process._getActiveHandles().length === 0` asserted in
the integration test).

## 5. Acceptance criteria (Phase 3 gate)

1. `bootRuntime()` exists and is the only place `MemoryStore`,
   `ModelRouter`, and channels are constructed.
2. `AgentContext.memory` is non-optional; every agent receives it.
3. `argent chat` round-trips one prompt against a stub provider in CI
   and against real ollama in the operator smoke test.
4. Memory rows for the round trip are visible in `memory.sqlite` and
   queryable via `MemoryStore.query({ kind: "router.out" })`.
5. SIGINT path closes channel, scheduler, and DB in that order; test
   asserts no leaked handles.
6. `pnpm check` and `pnpm test` stay green; no slice outside the
   authorized surface is touched.

## 6. Open questions

1. **Retention defaults at first boot.** `memory-lite-design` §5 sets
   10 000 events/agent and a 256 MB soft cap. Phase 3 runtime slice
   should ship those defaults *unconfigured* (no env override) so the
   smoke test exercises the same path the operator will hit. Confirm
   with engineer-auth before merge.
2. **Channel auth.** `cli-stdio` is unauthenticated by construction
   (local TTY); runtime slice binds no network listener.
3. **Memory event kinds.** Proposed vocabulary: `channel.in`,
   `channel.out`, `router.in`, `router.out`, `agent.error`. Lock this
   in the runtime slice so retention/telemetry slices can index on it.
4. **Provider selection in `bootRuntime()`.** Phase 3 hardcodes ollama;
   the existing `ModelRouter` policy stays untouched. Multi-provider
   selection is a Phase 4 concern.
5. **Where `bootRuntime()` lives.** `src/integration/` is currently
   doc-only. Adding `runtime.ts` there keeps `src/cli/` thin and
   matches the layering already implied by `memory-telemetry`'s
   planned home.
6. **Satellite mode.** Out of scope. The runtime slice runs standalone
   only; satellite wiring is a separate channel adapter once the Mac
   side exists.

## 7. Recommended follow-on slices (names only, no claims)

- `memory-store-impl`, `channel-core` (gatekeepers, already designed)
- `channel-cli-stdio`
- `phase3-runtime-slice` (this plan's §3)
- `memory-retention`, `memory-telemetry`, `channel-file-watch`,
  `channel-http-post` (parallel once the runtime slice is green)
