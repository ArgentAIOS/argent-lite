import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

// Public surface lock. Any removal here is a breaking change — the
// removal PR must update this test explicitly.
const EXPECTED_VALUE_EXPORTS: readonly string[] = [
  // Runtime
  "bootRuntime",
  // Agents
  "BaseAgent",
  "MessageBus",
  "createAgentContext",
  "withRouter",
  "RouterAgent",
  "RouterAgentError",
  "HelloAgent",
  // Scheduler
  "Scheduler",
  "TaskQueue",
  // Router + providers
  "ModelRouter",
  "createRouter",
  "instrumentRouter",
  "withMemoryLog",
  "createDefaultRouter",
  "routerHealth",
  "OllamaProvider",
  "AnthropicProvider",
  "OpenAIProvider",
  "HailoProvider",
  "HailoUnavailableError",
  // Auth
  "createCredentialStore",
  // Memory
  "createMemoryStore",
  "withRetention",
  // Channels
  "CliStdioChannel",
  "HttpChannel",
  // Intents
  "createIntentRouter",
  // Observability
  "createLogger",
  "createMetrics",
  // Runtime vocabulary
  "EVENT_KINDS",
  "isEventKind",
  "assertEventKind",
  // Mode
  "loadMode",
];

describe("public API surface", () => {
  it.each(EXPECTED_VALUE_EXPORTS)("exports %s", (name) => {
    const mod = api as unknown as Record<string, unknown>;
    expect(mod[name]).toBeDefined();
  });

  it("exposes EVENT_KINDS as a non-empty frozen array", () => {
    expect(Array.isArray(api.EVENT_KINDS)).toBe(true);
    expect(api.EVENT_KINDS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(api.EVENT_KINDS)).toBe(true);
  });

  it("bootRuntime is a function", () => {
    expect(typeof api.bootRuntime).toBe("function");
  });

  it("createLogger/createMetrics return objects", () => {
    const logger = api.createLogger();
    expect(typeof logger.info).toBe("function");
    const metrics = api.createMetrics();
    expect(typeof metrics.snapshot).toBe("function");
  });
});
