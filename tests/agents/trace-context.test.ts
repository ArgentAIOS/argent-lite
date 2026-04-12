import { describe, expect, it } from "vitest";
import {
  TRACE_HEADER,
  getTraceId,
  newTraceId,
  stampTrace,
} from "../../src/agents/trace-context.js";
import type { AgentMessage } from "../../src/agents/types.js";

function makeMessage(payload: unknown): AgentMessage {
  return {
    id: "m1",
    from: "a",
    to: "b",
    kind: "test",
    payload,
    ts: 0,
  };
}

describe("trace-context", () => {
  it("exports the trace header constant", () => {
    expect(TRACE_HEADER).toBe("trace_id");
  });

  it("newTraceId returns 32 hex chars", () => {
    const id = newTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("newTraceId returns unique ids across calls", () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).not.toBe(b);
  });

  it("generates 100 unique trace ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      ids.add(newTraceId());
    }
    expect(ids.size).toBe(100);
  });

  it("stampTrace adds trace_id without mutating input", () => {
    const input = { prompt: "hi" };
    const traceId = newTraceId();
    const stamped = stampTrace(input, traceId);
    expect(stamped.trace_id).toBe(traceId);
    expect(stamped.prompt).toBe("hi");
    expect(input).not.toHaveProperty("trace_id");
  });

  it("getTraceId returns the id when present", () => {
    const traceId = newTraceId();
    const msg = makeMessage({ prompt: "hi", trace_id: traceId });
    expect(getTraceId(msg)).toBe(traceId);
  });

  it("getTraceId returns undefined when payload lacks trace_id", () => {
    const msg = makeMessage({ prompt: "hi" });
    expect(getTraceId(msg)).toBeUndefined();
  });

  it("getTraceId returns undefined when payload is not an object", () => {
    expect(getTraceId(makeMessage(null))).toBeUndefined();
    expect(getTraceId(makeMessage("trace"))).toBeUndefined();
    expect(getTraceId(makeMessage(42))).toBeUndefined();
  });

  it("getTraceId returns undefined when trace_id is malformed", () => {
    const msg = makeMessage({ trace_id: 123 });
    expect(getTraceId(msg)).toBeUndefined();
  });
});
