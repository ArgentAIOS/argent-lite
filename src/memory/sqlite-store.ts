import {
  MemoryStoreError,
  type MemoryEvent,
  type MemoryQueryOpts,
  type MemoryStore,
} from "./types.js";

export interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface KvRow {
  value_json: string;
}

interface KeyRow {
  key: string;
}

interface EventRow {
  id: string;
  ts: number;
  kind: string;
  payload_json: string;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kv (
  agent_id   TEXT NOT NULL,
  key        TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (agent_id, key)
);
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  ts           INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_agent_ts ON events(agent_id, ts DESC);
`;

export class SqliteMemoryStore implements MemoryStore {
  private readonly db: SqliteDatabase;
  private lock: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  init(): void {
    this.db.exec(SCHEMA_SQL);
  }

  private withLock<T>(fn: () => T): Promise<T> {
    const next = this.lock.then(() => {
      if (this.closed) {
        throw new MemoryStoreError("memory store is closed");
      }
      return fn();
    });
    this.lock = next.catch(() => undefined);
    return next;
  }

  async get(agentId: string, key: string): Promise<unknown> {
    return this.withLock(() => {
      const row = this.db
        .prepare("SELECT value_json FROM kv WHERE agent_id = ? AND key = ?")
        .get(agentId, key) as KvRow | undefined;
      if (row === undefined) return undefined;
      return JSON.parse(row.value_json);
    });
  }

  async set(agentId: string, key: string, value: unknown): Promise<void> {
    await this.withLock(() => {
      const stmt = this.db.prepare(
        `INSERT INTO kv (agent_id, key, value_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(agent_id, key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
      );
      stmt.run(agentId, key, JSON.stringify(value), Date.now());
    });
  }

  async list(agentId: string): Promise<string[]> {
    return this.withLock(() => {
      const rows = this.db
        .prepare("SELECT key FROM kv WHERE agent_id = ? ORDER BY key ASC")
        .all(agentId) as KeyRow[];
      return rows.map((r) => r.key);
    });
  }

  async append(agentId: string, event: MemoryEvent): Promise<void> {
    await this.withLock(() => {
      this.db
        .prepare(
          `INSERT INTO events (id, agent_id, ts, kind, payload_json)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          agentId,
          event.ts,
          event.kind,
          JSON.stringify(event.payload),
        );
    });
  }

  async query(
    agentId: string,
    opts: MemoryQueryOpts = {},
  ): Promise<MemoryEvent[]> {
    return this.withLock(() => {
      const since = opts.sinceTs ?? 0;
      const limit = opts.limit ?? 100;
      const rows = this.db
        .prepare(
          `SELECT id, ts, kind, payload_json FROM events
           WHERE agent_id = ? AND ts >= ?
           ORDER BY ts DESC
           LIMIT ?`,
        )
        .all(agentId, since, limit) as EventRow[];
      return rows.map((r) => ({
        id: r.id,
        ts: r.ts,
        kind: r.kind,
        payload: JSON.parse(r.payload_json),
      }));
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.lock.catch(() => undefined);
    this.closed = true;
    this.db.close();
  }
}
