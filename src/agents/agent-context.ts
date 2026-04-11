import type { MemoryStore } from "../memory/types.js";
import { MessageBus } from "./message-bus.js";

export interface AgentLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface AgentContext {
  readonly logger: AgentLogger;
  readonly bus: MessageBus;
  readonly now: () => number;
  readonly abort: AbortSignal;
  readonly memory: MemoryStore;
}

export interface CreateAgentContextOptions {
  memory: MemoryStore;
  bus?: MessageBus;
  logger?: AgentLogger;
  now?: () => number;
  abort?: AbortSignal;
}

const noopLogger: AgentLogger = {
  info() {},
  warn() {},
  error() {},
};

export class AgentContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentContextError";
  }
}

export function createAgentContext(opts: CreateAgentContextOptions): AgentContext {
  if (opts === null || typeof opts !== "object" || opts.memory == null) {
    throw new AgentContextError("createAgentContext requires a memory store");
  }
  return {
    logger: opts.logger ?? noopLogger,
    bus: opts.bus ?? new MessageBus(),
    now: opts.now ?? (() => Date.now()),
    abort: opts.abort ?? new AbortController().signal,
    memory: opts.memory,
  };
}
