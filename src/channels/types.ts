import type { AgentMessage } from "../agents/types.js";

export interface Channel {
  readonly id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface ChannelBus {
  send(msg: AgentMessage): void;
  subscribe(id: string, handler: (msg: AgentMessage) => void): () => void;
}

export interface ChannelOptions {
  agentId: string;
  bus: ChannelBus;
}
