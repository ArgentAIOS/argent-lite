# Task 012 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: phase3-runtime-slice
Branch: codex/phase3-runtime-slice (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/integration/runtime.ts
- src/integration/index.ts
- src/cli/chat.ts
- tests/integration/runtime.test.ts

## Context

`ops/projects/phase3-acceptance.md` §5(5)+(6): implement `bootRuntime()`
as the single constructor that wires memory + router + channel +
scheduler + IntentRouter, and add an `argent chat` subcommand that
drives the loop. This consolidates items #5 and #6 from the
acceptance doc.

## Goal

1. **`src/integration/runtime.ts`** — async function `bootRuntime(opts)`:
   - Signature:
     ```ts
     export interface RuntimeOptions {
       stdin?: NodeJS.ReadableStream;
       stdout?: NodeJS.WritableStream;
       memoryPath?: string;
       providers?: Provider[];            // default: [] — caller fills in
       credentials?: CredentialStore;
       now?: () => number;
     }
     export interface Runtime {
       shutdown(): Promise<void>;
       memory: MemoryStore;
       router: Router;
       scheduler: Scheduler;
     }
     export async function bootRuntime(opts?: RuntimeOptions): Promise<Runtime>;
     ```
   - Constructs a `MemoryStore` (SqliteMemoryStore if `memoryPath`
     given, otherwise an in-memory fake imported from
     `../agents/__fixtures__/noop-memory.js` if available via dynamic
     import; else throw).
   - Constructs `ModelRouter` with policy `local-first`. Registers any
     providers passed in.
   - Wraps router with `withMemoryLog({ inner, memory, agentId: "router" })`
     and then `instrumentRouter({ inner, metrics, logger })`.
   - Constructs a `Scheduler`, a `MessageBus`, an `AgentContext`
     (carrying memory, bus, now), a `RouterAgent("router", ctx)`.
   - Constructs a `CliStdioChannel({ agentId: "router", bus, stdin, stdout })`.
   - Creates an `IntentRouter`, registers one handler
     `{ agentId: "router", matches: (msg) => true, priority: 1 }`.
     Subscribes the bus for `to === "channel"` messages and delegates
     via IntentRouter to the router agent.
   - Writes a `channel.in` event to memory for each prompt received,
     and a `channel.out` event for each reply emitted. Use
     `assertEventKind` from `src/runtime/event-kinds.js` to enforce
     the vocabulary (import via try/catch in case cycle-12
     event-kind-lock hasn't merged — fall back to a hard-coded list).
   - `shutdown()` awaits: `channel.stop()` → `scheduler.stop()` →
     `memory.close()`. Clean order.
2. **`src/integration/index.ts`** — re-exports `bootRuntime`, types.
3. **`src/cli/chat.ts`** — `runChat(argv)` async:
   - Calls `bootRuntime({ stdin: process.stdin, stdout: process.stdout })`.
   - Installs SIGINT handler that calls `runtime.shutdown()` then exits 0.
   - Otherwise awaits the process to end naturally on EOF.
4. **`tests/integration/runtime.test.ts`** — inject a stub `Provider`
   (shape matches the one engineer-floor's cycle-12 slice ships at
   `tests/integration/stub-provider.ts` — duplicate the stub here to
   stay self-contained; threadmaster will dedupe at integration).
   Uses `stream.PassThrough` for stdin/stdout, writes a line, asserts
   a reply and clean shutdown.

## Constraints

- Do NOT touch `src/agents/base-agent.ts`, `src/memory/**` impl,
  `src/router/router.ts`, `src/channels/cli-stdio.ts`, or
  `src/scheduler/**`. Use them as imports.
- Import `withMemoryLog` from `../router/memory-router.js`.
- Import `instrumentRouter` from `../router/instrumented-router.js`.
- Import `createLogger` from `../obs/logger.js`; `createMetrics` from `../obs/metrics.js`.
- Import `RouterAgent` from `../agents/router-agent.js`.
- Import `createIntentRouter` from `../intents/router.js`.
- Import `withRouter` from `../agents/context-with-router.js`.
- `AgentContext` now requires a `memory` arg (cycle-12
  agent-context-memory slice). If that hasn't landed yet on your
  branch, construct a minimal fake MemoryStore locally to satisfy
  compilation.
- Strict TS, no `any`.

## Acceptance criterion

- 4 files exist.
- `pnpm check` passes.
- `pnpm test tests/integration/runtime.test.ts` passes.
- SELF-COMMIT, PUSH, PR.

## Deadline

Before next cron tick.
