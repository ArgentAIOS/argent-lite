export type AgentState =
  | "init"
  | "ready"
  | "running"
  | "suspended"
  | "stopped";

export interface SchedulableAgent {
  readonly id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  state: AgentState;
}

export interface ScheduledTask {
  id: string;
  agentId: string;
  runAt: number;
  payload: unknown;
}

export interface SchedulerOptions {
  maxConcurrent?: number;
  now?: () => number;
}
