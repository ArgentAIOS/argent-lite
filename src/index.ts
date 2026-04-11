// Library entrypoint for Argent Lite.
// Public API surface — re-exports only. Future removals must update
// tests/public-api.test.ts which locks this surface.

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
export { ModelRouter, createRouter } from "./router/index.js";
export { instrumentRouter } from "./router/instrumented-router.js";
export { withMemoryLog } from "./router/memory-router.js";
export { createDefaultRouter } from "./router/default-router.js";
export { routerHealth } from "./router/health.js";
export { OllamaProvider } from "./providers/ollama.js";
export { AnthropicProvider } from "./providers/anthropic.js";
export { OpenAIProvider } from "./providers/openai.js";
export { HailoProvider, HailoUnavailableError } from "./providers/hailo.js";
export type {
  Provider,
  Router,
  CompletionRequest,
  CompletionResponse,
  RoutePolicy,
} from "./router/types.js";

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
export { createMetrics, type Metrics, type MetricsSnapshot } from "./obs/metrics.js";
export type { Logger } from "./obs/types.js";

// Runtime vocabulary
export {
  EVENT_KINDS,
  isEventKind,
  assertEventKind,
  type EventKind,
} from "./runtime/event-kinds.js";

// Mode
export { loadMode, type RuntimeMode } from "./config/mode.js";
