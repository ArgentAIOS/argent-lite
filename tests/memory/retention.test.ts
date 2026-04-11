import { describe, it, expect } from "vitest";
import { withRetention } from "../../src/memory/retention.js";
import type {
  MemoryEvent,
  MemoryQueryOpts,
  MemoryStore,
} from "../../src/memory/index.js";

class FakeStore implements MemoryStore {
  private kv = new Map<string, Map<string, unknown>>();
  private events = new Map<string, MemoryEvent[]>();
  public closed = false;

  async get(agentId: string, key: string): Promise<unknown> {
    return this.kv.get(agentId)?.get(key);
  }

  async set(agentId: string, key: string, value: unknown): Promise<void> {
    let m = this.kv.get(agentId);
    if (!m) {
      m = new Map();
      this.kv.set(agentId, m);
    }
    m.set(key, value);
  }

  async list(agentId: string): Promise<string[]> {
    return [...(this.kv.get(agentId)?.keys() ?? [])];
  }

  async append(agentId: string, event: MemoryEvent): Promise<void> {
    let arr = this.events.get(agentId);
    if (!arr) {
      arr = [];
      this.events.set(agentId, arr);
    }
    arr.push(event);
  }

  async query(
    agentId: string,
    opts?: MemoryQueryOpts,
  ): Promise<MemoryEvent[]> {
    let arr = [...(this.events.get(agentId) ?? [])];
    if (opts?.sinceTs !== undefined) {
      const since = opts.sinceTs;
      arr = arr.filter((e) => e.ts >= since);
    }
    if (opts?.limit !== undefined) {
      arr = arr.slice(-opts.limit);
    }
    return arr;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function makeEvent(id: string, ts: number, kind = "test"): MemoryEvent {
  return { id, ts, kind, payload: null };
}

describe("withRetention", () => {
  it("expires keys older than keyTtlMs on get()", async () => {
    let clock = 1_000;
    const fake = new FakeStore();
    const store = withRetention(fake, {
      keyTtlMs: 100,
      now: () => clock,
    });

    await store.set("a", "k1", "v1");
    expect(await store.get("a", "k1")).toBe("v1");

    clock += 50;
    expect(await store.get("a", "k1")).toBe("v1");

    clock += 100;
    expect(await store.get("a", "k1")).toBeUndefined();
  });

  it("list() hides expired keys but keeps fresh ones", async () => {
    let clock = 0;
    const fake = new FakeStore();
    const store = withRetention(fake, {
      keyTtlMs: 100,
      now: () => clock,
    });

    await store.set("a", "old", 1);
    clock += 200;
    await store.set("a", "fresh", 2);

    const keys = await store.list("a");
    expect(keys).toEqual(["fresh"]);
    expect(await store.get("a", "fresh")).toBe(2);
    expect(await store.get("a", "old")).toBeUndefined();
  });

  it("non-expired keys survive indefinitely when no TTL is set", async () => {
    let clock = 0;
    const fake = new FakeStore();
    const store = withRetention(fake, { now: () => clock });

    await store.set("a", "k", "v");
    clock += 10_000_000;
    expect(await store.get("a", "k")).toBe("v");
    expect(await store.list("a")).toEqual(["k"]);
  });

  it("enforces maxEventsPerAgent on append, keeping newest", async () => {
    const fake = new FakeStore();
    const store = withRetention(fake, { maxEventsPerAgent: 3 });

    for (let i = 0; i < 5; i++) {
      await store.append("a", makeEvent(`e${i}`, i));
    }

    const visible = await store.query("a");
    const ids = visible.map((e) => e.id).sort();
    expect(ids).toEqual(["e2", "e3", "e4"]);
  });

  it("event cap is per-agent", async () => {
    const fake = new FakeStore();
    const store = withRetention(fake, { maxEventsPerAgent: 2 });

    await store.append("a", makeEvent("a1", 1));
    await store.append("a", makeEvent("a2", 2));
    await store.append("a", makeEvent("a3", 3));
    await store.append("b", makeEvent("b1", 1));

    const a = (await store.query("a")).map((e) => e.id).sort();
    const b = (await store.query("b")).map((e) => e.id).sort();
    expect(a).toEqual(["a2", "a3"]);
    expect(b).toEqual(["b1"]);
  });

  it("close() delegates to the wrapped store", async () => {
    const fake = new FakeStore();
    const store = withRetention(fake);
    await store.close();
    expect(fake.closed).toBe(true);
  });
});
