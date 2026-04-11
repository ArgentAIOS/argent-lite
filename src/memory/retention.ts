import type {
  MemoryEvent,
  MemoryQueryOpts,
  MemoryStore,
} from "./types.js";

export interface RetentionOptions {
  keyTtlMs?: number;
  maxEventsPerAgent?: number;
  now?: () => number;
}

interface AgentState {
  writeTs: Map<string, number>;
  evictedEventIds: Set<string>;
}

export function withRetention(
  store: MemoryStore,
  opts: RetentionOptions = {},
): MemoryStore {
  const keyTtlMs = opts.keyTtlMs;
  const maxEventsPerAgent = opts.maxEventsPerAgent ?? 1000;
  const now = opts.now ?? ((): number => Date.now());

  const state = new Map<string, AgentState>();
  const stateFor = (agentId: string): AgentState => {
    let s = state.get(agentId);
    if (!s) {
      s = { writeTs: new Map(), evictedEventIds: new Set() };
      state.set(agentId, s);
    }
    return s;
  };

  const isExpired = (ts: number | undefined): boolean => {
    if (keyTtlMs === undefined || ts === undefined) return false;
    return now() - ts >= keyTtlMs;
  };

  return {
    async get(agentId: string, key: string): Promise<unknown> {
      const s = stateFor(agentId);
      const ts = s.writeTs.get(key);
      if (isExpired(ts)) {
        return undefined;
      }
      return store.get(agentId, key);
    },

    async set(agentId: string, key: string, value: unknown): Promise<void> {
      await store.set(agentId, key, value);
      stateFor(agentId).writeTs.set(key, now());
    },

    async list(agentId: string): Promise<string[]> {
      const s = stateFor(agentId);
      const keys = await store.list(agentId);
      const out: string[] = [];
      for (const k of keys) {
        if (isExpired(s.writeTs.get(k))) continue;
        out.push(k);
      }
      return out;
    },

    async append(agentId: string, event: MemoryEvent): Promise<void> {
      await store.append(agentId, event);
      const s = stateFor(agentId);
      const all = await store.query(agentId);
      const visible = all.filter((e) => !s.evictedEventIds.has(e.id));
      if (visible.length > maxEventsPerAgent) {
        const sorted = [...visible].sort((a, b) => b.ts - a.ts);
        for (const e of sorted.slice(maxEventsPerAgent)) {
          s.evictedEventIds.add(e.id);
        }
      }
    },

    async query(
      agentId: string,
      queryOpts?: MemoryQueryOpts,
    ): Promise<MemoryEvent[]> {
      const s = stateFor(agentId);
      const all = await store.query(agentId, queryOpts);
      return all.filter((e) => !s.evictedEventIds.has(e.id));
    },

    async close(): Promise<void> {
      await store.close();
    },
  };
}
