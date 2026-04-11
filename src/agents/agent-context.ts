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
}

export interface CreateAgentContextOptions {
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

export function createAgentContext(opts: CreateAgentContextOptions = {}): AgentContext {
  return {
    logger: opts.logger ?? noopLogger,
    bus: opts.bus ?? new MessageBus(),
    now: opts.now ?? (() => Date.now()),
    abort: opts.abort ?? new AbortController().signal,
  };
}
