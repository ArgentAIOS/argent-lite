import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStore, loadSqliteModule } from "../../src/memory/index.js";
import type { MemoryStore } from "../../src/memory/index.js";

let sqliteAvailable = false;
beforeAll(async () => {
  try {
    await loadSqliteModule();
    sqliteAvailable = true;
  } catch (err) {
    sqliteAvailable = false;
    // eslint-disable-next-line no-console
    console.warn(
      "[memory/store.test] node:sqlite unavailable — skipping:",
      (err as Error).message,
    );
  }
});

function makeTmpPath(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "argent-mem-"));
  return { dir, path: join(dir, "memory.sqlite") };
}

async function withStore(
  fn: (store: MemoryStore) => Promise<void>,
): Promise<void> {
  const { dir, path } = makeTmpPath();
  const store = await createMemoryStore({ path });
  try {
    await fn(store);
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("createMemoryStore", () => {
  it("opens and closes a fresh store", async () => {
    if (!sqliteAvailable) return;
    await withStore(async () => {
      // open + close handled by helper
    });
  });

  it("round-trips get/set with structured values", async () => {
    if (!sqliteAvailable) return;
    await withStore(async (store) => {
      await store.set("agent-a", "profile", { name: "Argent", level: 7 });
      const got = await store.get("agent-a", "profile");
      expect(got).toEqual({ name: "Argent", level: 7 });
    });
  });

  it("returns undefined for missing keys", async () => {
    if (!sqliteAvailable) return;
    await withStore(async (store) => {
      const got = await store.get("agent-a", "nope");
      expect(got).toBeUndefined();
    });
  });

  it("lists keys per agent", async () => {
    if (!sqliteAvailable) return;
    await withStore(async (store) => {
      await store.set("agent-a", "k1", 1);
      await store.set("agent-a", "k2", 2);
      await store.set("agent-b", "k3", 3);
      const a = await store.list("agent-a");
      const b = await store.list("agent-b");
      expect(a.sort()).toEqual(["k1", "k2"]);
      expect(b).toEqual(["k3"]);
    });
  });

  it("appends and queries events with sinceTs and limit", async () => {
    if (!sqliteAvailable) return;
    await withStore(async (store) => {
      await store.append("agent-a", {
        id: "e1",
        ts: 100,
        kind: "tick",
        payload: { n: 1 },
      });
      await store.append("agent-a", {
        id: "e2",
        ts: 200,
        kind: "tick",
        payload: { n: 2 },
      });
      await store.append("agent-a", {
        id: "e3",
        ts: 300,
        kind: "tick",
        payload: { n: 3 },
      });

      const all = await store.query("agent-a");
      expect(all.map((e) => e.id)).toEqual(["e3", "e2", "e1"]);

      const since = await store.query("agent-a", { sinceTs: 200 });
      expect(since.map((e) => e.id)).toEqual(["e3", "e2"]);

      const limited = await store.query("agent-a", { limit: 1 });
      expect(limited.map((e) => e.id)).toEqual(["e3"]);
    });
  });
});
