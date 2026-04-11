import { EventEmitter } from "node:events";
import type { AgentMessage } from "./types.js";

export type MessageHandler = (msg: AgentMessage) => void | Promise<void>;

export class MessageBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  send(msg: AgentMessage): void {
    this.emitter.emit(msg.to, msg);
  }

  subscribe(agentId: string, handler: MessageHandler): () => void {
    this.emitter.on(agentId, handler);
    return () => {
      this.emitter.off(agentId, handler);
    };
  }
}
