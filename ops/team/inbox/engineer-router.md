# Task 014 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: public-api-surface
Branch: codex/public-api-surface (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/index.ts
- tests/public-api.test.ts

## Context

`src/index.ts` is currently a stub with `export {};`. For Phase 3 wrap,
the library should expose a coherent public surface so consumers can
`import { bootRuntime, createLogger, createMetrics } from "@argentaios/argent-lite"`.

## Goal

1. **`src/index.ts`** — re-export the public Phase 3 surface:
   ```ts
   // Runtime
   export { bootRuntime, type Runtime, type RuntimeOptions } from "./integration/runtime.js";

   // Agents
   export { BaseAgent } from "./agents/base-agent.js";
   export { MessageBus } from "./agents/message-bus.js";
   export { createAgentContext, type AgentContext } from "./agents/agent-context.js";
   export { withRouter, type AgentContextWithRouter } from "./agents/context-with-router.js";
   export { RouterAgent, RouterAgentError } from "./agents/router-agent.js";
   export { HelloAgent } from "./agents/hello-agent.js";
   export type { AgentMessage, AgentState, AgentDescriptor } from "./agents/types.js";

   // Scheduler
   export { Scheduler } from "./scheduler/scheduler.js";
   export { TaskQueue } from "./scheduler/task-queue.js";
   export type { SchedulableAgent, ScheduledTask, SchedulerOptions } from "./scheduler/types.js";

   // Router + providers
   export { ModelRouter, createRouter, instrumentRouter } from "./router/index.js";
   export { withMemoryLog } from "./router/memory-router.js";
   export { createDefaultRouter } from "./router/default-router.js";
   export { routerHealth } from "./router/health.js";
   export { OllamaProvider } from "./providers/ollama.js";
   export { AnthropicProvider } from "./providers/anthropic.js";
   export { OpenAIProvider } from "./providers/openai.js";
   export { HailoProvider, HailoUnavailableError } from "./providers/hailo.js";
   export type { Provider, Router, CompletionRequest, CompletionResponse, RoutePolicy } from "./router/types.js";

   // Auth / credentials
   export { createCredentialStore } from "./auth/index.js";
   export type { CredentialStore, ProviderId } from "./auth/types.js";

   // Memory
   export { createMemoryStore } from "./memory/store.js";
   export { withRetention } from "./memory/retention.js";
   export type { MemoryStore, MemoryEvent } from "./memory/types.js";

   // Channels
   export { CliStdioChannel } from "./channels/cli-stdio.js";
   export { HttpChannel } from "./channels/http.js";
   export type { Channel, ChannelOptions } from "./channels/types.js";

   // Intents
   export { createIntentRouter } from "./intents/router.js";
   export type { IntentRouter, IntentHandler } from "./intents/types.js";

   // Observability
   export { createLogger } from "./obs/logger.js";
   export { createMetrics } from "./obs/metrics.js";
   export type { Logger, Metrics, MetricsSnapshot } from "./obs/types.js";

   // Runtime vocabulary
   export { EVENT_KINDS, isEventKind, assertEventKind, type EventKind } from "./runtime/event-kinds.js";

   // Mode
   export { loadMode, type RuntimeMode } from "./config/mode.js";
   ```
   Adjust any names if a cited export doesn't exist in the current
   tree — **verify each re-export by reading the referenced file**
   before adding it. If an export is missing, flag it in the outbox
   but don't invent it.
2. **`tests/public-api.test.ts`** — imports each named export from
   `"../src/index.js"` and asserts they are defined. This is the
   "public surface lock" test — future removals need an explicit
   update.

## Constraints

- Read each module to verify export names before re-exporting.
- Do NOT add new functionality — only re-exports.
- If an export name is wrong, fix the re-export to match reality;
  do NOT edit the source module.
- Strict TS, no `any`.

## Acceptance criterion

- `src/index.ts` re-exports the full public surface.
- `pnpm check` and `pnpm test tests/public-api.test.ts` pass.
- SELF-COMMIT, PUSH, PR.

## Deadline: before next cron tick.
