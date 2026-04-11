import { randomBytes } from "node:crypto";
import type { AgentMessage } from "./types.js";

export const TRACE_HEADER = "trace_id";

export function newTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function stampTrace<T extends object>(
  payload: T,
  traceId: string,
): T & { trace_id: string } {
  return { ...payload, trace_id: traceId };
}

export function getTraceId(msg: AgentMessage): string | undefined {
  const payload = msg.payload;
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const candidate = (payload as { trace_id?: unknown }).trace_id;
  return typeof candidate === "string" ? candidate : undefined;
}
