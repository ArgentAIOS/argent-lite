export interface MemoryEvent {
  id: string;
  ts: number;
  kind: string;
  payload: unknown;
}

export interface MemoryQueryOpts {
  limit?: number;
  sinceTs?: number;
}

export interface MemoryStore {
  get(agentId: string, key: string): Promise<unknown>;
  set(agentId: string, key: string, value: unknown): Promise<void>;
  list(agentId: string): Promise<string[]>;
  append(agentId: string, event: MemoryEvent): Promise<void>;
  query(agentId: string, opts?: MemoryQueryOpts): Promise<MemoryEvent[]>;
  close(): Promise<void>;
}

export class MemoryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryStoreError";
  }
}
