export type AgentState = "init" | "ready" | "running" | "suspended" | "stopped";

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  kind: string;
  payload: unknown;
  ts: number;
}

export interface AgentDescriptor {
  id: string;
  state: AgentState;
  startedAt?: number;
}
