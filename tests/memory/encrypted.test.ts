import { describe, it, expect } from "vitest";
import type {
  MemoryEvent,
  MemoryQueryOpts,
  MemoryStore,
} from "../../src/memory/types.js";
import { withEncryption } from "../../src/memory/encrypted.js";

class FakeMemoryStore implements MemoryStore {
  public readonly kv = new Map<string, Map<string, unknown>>();
  public readonly events = new Map<string, MemoryEvent[]>();

  async get(agentId: string, key: string): Promise<unknown> {
    return this.kv.get(agentId)?.get(key);
  }

  async set(agentId: string, key: string, value: unknown): Promise<void> {
    let agent = this.kv.get(agentId);
    if (!agent) {
      agent = new Map();
      this.kv.set(agentId, agent);
    }
    agent.set(key, value);
  }

  async list(agentId: string): Promise<string[]> {
    return [...(this.kv.get(agentId)?.keys() ?? [])];
  }

  async append(agentId: string, event: MemoryEvent): Promise<void> {
    const existing = this.events.get(agentId) ?? [];
    existing.push(event);
    this.events.set(agentId, existing);
  }

  async query(
    agentId: string,
    opts?: MemoryQueryOpts,
  ): Promise<MemoryEvent[]> {
    let evs = (this.events.get(agentId) ?? []).slice();
    if (opts?.sinceTs !== undefined) {
      const since = opts.sinceTs;
      evs = evs.filter((e) => e.ts >= since);
    }
    if (opts?.limit !== undefined) {
      evs = evs.slice(0, opts.limit);
    }
    return evs;
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

const SECRET = "test-secret-test-secret-test-secret-1234";

describe("withEncryption", () => {
  it("round-trips set/get", async () => {
    const inner = new FakeMemoryStore();
    const store = withEncryption({ inner, secret: SECRET });
    await store.set("agent-1", "k1", { hello: "world", n: 42 });
    const v = await store.get("agent-1", "k1");
    expect(v).toEqual({ hello: "world", n: 42 });
  });

  it("stored value is not plaintext", async () => {
    const inner = new FakeMemoryStore();
    const store = withEncryption({ inner, secret: SECRET });
    await store.set("agent-1", "k1", { secret: "SUPER_SECRET_TOKEN" });
    const raw = inner.kv.get("agent-1")?.get("k1");
    const serialized = JSON.stringify(raw);
    expect(serialized).not.toContain("SUPER_SECRET_TOKEN");
    expect(raw).toMatchObject({ v: 1 });
  });

  it("list passes through keys unencrypted", async () => {
    const inner = new FakeMemoryStore();
    const store = withEncryption({ inner, secret: SECRET });
    await store.set("agent-1", "alpha", 1);
    await store.set("agent-1", "beta", 2);
    const keys = await store.list("agent-1");
    expect(keys.sort()).toEqual(["alpha", "beta"]);
  });

  it("returns undefined for missing keys", async () => {
    const inner = new FakeMemoryStore();
    const store = withEncryption({ inner, secret: SECRET });
    expect(await store.get("agent-1", "missing")).toBeUndefined();
  });

  it("throws MemoryDecryptError on wrong secret", async () => {
    const inner = new FakeMemoryStore();
    const writer = withEncryption({ inner, secret: SECRET });
    await writer.set("agent-1", "k1", { hello: "world" });
    const reader = withEncryption({
      inner,
      secret: "a-different-secret-a-different-secret-xyz",
    });
    await expect(reader.get("agent-1", "k1")).rejects.toThrow(/decrypt/i);
  });

  it("round-trips append/query with multiple events", async () => {
    const inner = new FakeMemoryStore();
    const store = withEncryption({ inner, secret: SECRET });
    const events: MemoryEvent[] = [
      { id: "e1", ts: 100, kind: "note", payload: { text: "first" } },
      { id: "e2", ts: 200, kind: "note", payload: { text: "second", n: 2 } },
      { id: "e3", ts: 300, kind: "other", payload: null },
    ];
    for (const e of events) await store.append("agent-1", e);

    const got = await store.query("agent-1");
    expect(got).toEqual(events);

    const rawEvents = inner.events.get("agent-1") ?? [];
    const serialized = JSON.stringify(rawEvents);
    expect(serialized).not.toContain("first");
    expect(serialized).not.toContain("second");
    for (const raw of rawEvents) {
      expect(raw.payload).toMatchObject({ v: 1 });
    }
  });

  it("respects query opts (limit, sinceTs) under encryption", async () => {
    const inner = new FakeMemoryStore();
    const store = withEncryption({ inner, secret: SECRET });
    await store.append("agent-1", {
      id: "e1",
      ts: 100,
      kind: "k",
      payload: { a: 1 },
    });
    await store.append("agent-1", {
      id: "e2",
      ts: 200,
      kind: "k",
      payload: { a: 2 },
    });
    await store.append("agent-1", {
      id: "e3",
      ts: 300,
      kind: "k",
      payload: { a: 3 },
    });
    const since = await store.query("agent-1", { sinceTs: 200 });
    expect(since.map((e) => e.id)).toEqual(["e2", "e3"]);
    const limited = await store.query("agent-1", { limit: 2 });
    expect(limited.map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});
