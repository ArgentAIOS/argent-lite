import { describe, it, expect, beforeAll } from "vitest";
import {
  SqliteMemoryStore,
  loadSqliteModule,
  MemoryStoreError,
  type SqliteDatabase,
} from "../../src/memory/index.js";

let DatabaseSync: (new (path: string) => SqliteDatabase) | null = null;
beforeAll(async () => {
  try {
    const mod = await loadSqliteModule();
    DatabaseSync = mod.DatabaseSync;
  } catch {
    DatabaseSync = null;
    // eslint-disable-next-line no-console
    console.warn("[memory/sqlite-store.test] node:sqlite unavailable — skipping");
  }
});

function makeStore(): SqliteMemoryStore {
  if (!DatabaseSync) throw new Error("unreachable");
  const db = new DatabaseSync(":memory:");
  const store = new SqliteMemoryStore(db);
  store.init();
  return store;
}

describe("SqliteMemoryStore", () => {
  it("creates schema on init (kv + events tables usable)", async () => {
    if (!DatabaseSync) return;
    const store = makeStore();
    try {
      await store.set("a", "k", "v");
      await store.append("a", { id: "e1", ts: 1, kind: "x", payload: null });
      const v = await store.get("a", "k");
      const events = await store.query("a");
      expect(v).toBe("v");
      expect(events).toHaveLength(1);
    } finally {
      await store.close();
    }
  });

  it("serializes concurrent writes via the async mutex", async () => {
    if (!DatabaseSync) return;
    const store = makeStore();
    try {
      const writes: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        writes.push(store.set("agent", `k${i}`, i));
        writes.push(
          store.append("agent", {
            id: `e${i}`,
            ts: i,
            kind: "tick",
            payload: { i },
          }),
        );
      }
      await Promise.all(writes);

      const keys = await store.list("agent");
      expect(keys).toHaveLength(50);
      const events = await store.query("agent", { limit: 1000 });
      expect(events).toHaveLength(50);
      // FIFO preserved per agent (descending by ts)
      const ids = events.map((e) => e.id);
      const expected = Array.from({ length: 50 }, (_, i) => `e${49 - i}`);
      expect(ids).toEqual(expected);
    } finally {
      await store.close();
    }
  });

  it("rejects operations after close", async () => {
    if (!DatabaseSync) return;
    const store = makeStore();
    await store.close();
    await expect(store.get("a", "k")).rejects.toBeInstanceOf(MemoryStoreError);
  });

  it("close is idempotent", async () => {
    if (!DatabaseSync) return;
    const store = makeStore();
    await store.close();
    await expect(store.close()).resolves.toBeUndefined();
  });
});
