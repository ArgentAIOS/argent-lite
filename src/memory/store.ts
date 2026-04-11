import { createRequire } from "node:module";
import { SqliteMemoryStore, type SqliteDatabase } from "./sqlite-store.js";
import { MemoryStoreError, type MemoryStore } from "./types.js";

export interface CreateMemoryStoreOpts {
  path: string;
}

export async function loadSqliteModule(): Promise<{
  DatabaseSync: new (path: string) => SqliteDatabase;
}> {
  // Use createRequire so test runners that pre-bundle ESM (e.g. vite/vitest)
  // don't try to resolve `node:sqlite` themselves; Node handles it natively.
  try {
    const require = createRequire(import.meta.url);
    const mod = require("node:sqlite") as {
      DatabaseSync?: new (path: string) => SqliteDatabase;
    };
    if (!mod.DatabaseSync) {
      throw new MemoryStoreError(
        "node:sqlite is not available; run with --experimental-sqlite on older Node",
      );
    }
    return { DatabaseSync: mod.DatabaseSync };
  } catch (err) {
    if (err instanceof MemoryStoreError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    throw new MemoryStoreError(
      `node:sqlite is not available; run with --experimental-sqlite on older Node (${reason})`,
    );
  }
}

export async function createMemoryStore(
  opts: CreateMemoryStoreOpts,
): Promise<MemoryStore> {
  const { DatabaseSync } = await loadSqliteModule();
  const db = new DatabaseSync(opts.path);
  const store = new SqliteMemoryStore(db);
  store.init();
  return store;
}
