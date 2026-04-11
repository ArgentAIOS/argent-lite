import type {
  MemoryEvent,
  MemoryQueryOpts,
  MemoryStore,
} from "../../memory/types.js";

export class NoopMemoryStore implements MemoryStore {
  private readonly kv = new Map<string, unknown>();
  private readonly events = new Map<string, MemoryEvent[]>();

  async get(agentId: string, key: string): Promise<unknown> {
    return this.kv.get(`${agentId}:${key}`);
  }

  async set(agentId: string, key: string, value: unknown): Promise<void> {
    this.kv.set(`${agentId}:${key}`, value);
  }

  async list(agentId: string): Promise<string[]> {
    const prefix = `${agentId}:`;
    const out: string[] = [];
    for (const k of this.kv.keys()) {
      if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
    return out;
  }

  async append(agentId: string, event: MemoryEvent): Promise<void> {
    const list = this.events.get(agentId) ?? [];
    list.push(event);
    this.events.set(agentId, list);
  }

  async query(agentId: string, opts: MemoryQueryOpts = {}): Promise<MemoryEvent[]> {
    const list = this.events.get(agentId) ?? [];
    const sinceTs = opts.sinceTs ?? -Infinity;
    const filtered = list.filter((e) => e.ts >= sinceTs);
    return opts.limit != null ? filtered.slice(-opts.limit) : filtered;
  }

  async close(): Promise<void> {}
}

export function createNoopMemory(): MemoryStore {
  return new NoopMemoryStore();
}
