import type { Logger, LogLevel, LogRecord } from "./types.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface CreateLoggerOptions {
  level?: LogLevel;
  out?: NodeJS.WritableStream;
  now?: () => number;
}

interface LoggerConfig {
  level: LogLevel;
  out: NodeJS.WritableStream;
  now: () => number;
  baseFields: Record<string, unknown>;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { value: safeValue(err) };
  }
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message,
  };
  if (err.stack) out.stack = err.stack;
  const cause = (err as { cause?: unknown }).cause;
  if (cause !== undefined) out.cause = serializeError(cause);
  return out;
}

function safeValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "bigint") return (value as bigint).toString();
  if (t === "function" || t === "symbol") return String(value);
  if (value instanceof Error) return serializeError(value);
  if (t === "object") {
    const obj = value as object;
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);
    if (Array.isArray(value)) {
      return value.map((v) => safeValue(v, seen));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = safeValue(v, seen);
    }
    return out;
  }
  return String(value);
}

function normalizeFields(
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = safeValue(v);
  }
  return out;
}

function makeLogger(config: LoggerConfig): Logger {
  const threshold = LEVEL_RANK[config.level];

  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>): void => {
    if (LEVEL_RANK[level] < threshold) return;
    const merged: Record<string, unknown> = { ...config.baseFields };
    if (fields) {
      for (const [k, v] of Object.entries(fields)) merged[k] = v;
    }
    const record: LogRecord = {
      level,
      msg,
      ts: config.now(),
    };
    const normalized = normalizeFields(merged);
    if (normalized && Object.keys(normalized).length > 0) {
      record.fields = normalized;
    }
    config.out.write(JSON.stringify(record) + "\n");
  };

  const logger: Logger = {
    child(fields) {
      return makeLogger({
        ...config,
        baseFields: { ...config.baseFields, ...fields },
      });
    },
    log(record) {
      if (LEVEL_RANK[record.level] < threshold) return;
      const merged: Record<string, unknown> = { ...config.baseFields };
      if (record.fields) {
        for (const [k, v] of Object.entries(record.fields)) merged[k] = v;
      }
      const out: LogRecord = {
        level: record.level,
        msg: record.msg,
        ts: record.ts,
      };
      const normalized = normalizeFields(merged);
      if (normalized && Object.keys(normalized).length > 0) {
        out.fields = normalized;
      }
      config.out.write(JSON.stringify(out) + "\n");
    },
    debug(msg, fields) {
      emit("debug", msg, fields);
    },
    info(msg, fields) {
      emit("info", msg, fields);
    },
    warn(msg, fields) {
      emit("warn", msg, fields);
    },
    error(msg, fields) {
      emit("error", msg, fields);
    },
  };

  return logger;
}

export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  return makeLogger({
    level: opts.level ?? "info",
    out: opts.out ?? process.stderr,
    now: opts.now ?? Date.now,
    baseFields: {},
  });
}
