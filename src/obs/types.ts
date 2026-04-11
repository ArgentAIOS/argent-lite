export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  msg: string;
  ts: number;
  fields?: Record<string, unknown>;
}

export interface Logger {
  child(fields: Record<string, unknown>): Logger;
  log(record: LogRecord): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}
