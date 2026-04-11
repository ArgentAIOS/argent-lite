import { PassThrough } from "node:stream";
import { describe, it, expect } from "vitest";
import { createLogger } from "../../src/obs/index.js";
import type { LogRecord } from "../../src/obs/index.js";

function drain(stream: PassThrough): LogRecord[] {
  const text = stream.read();
  if (!text) return [];
  return (text as Buffer)
    .toString("utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as LogRecord);
}

describe("createLogger", () => {
  it("round-trips JSON shape with injected ts", () => {
    const out = new PassThrough();
    const log = createLogger({ level: "debug", out, now: () => 1234 });
    log.info("hello", { a: 1 });
    const [rec] = drain(out);
    expect(rec).toEqual({
      level: "info",
      msg: "hello",
      ts: 1234,
      fields: { a: 1 },
    });
  });

  it("drops records below configured level", () => {
    const out = new PassThrough();
    const log = createLogger({ level: "warn", out, now: () => 1 });
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    const recs = drain(out);
    expect(recs.map((r) => r.level)).toEqual(["warn", "error"]);
  });

  it("child logger merges base fields into every record", () => {
    const out = new PassThrough();
    const log = createLogger({ level: "debug", out, now: () => 7 });
    const child = log.child({ component: "router", run: "r1" });
    child.info("msg", { extra: true });
    const grand = child.child({ tag: "t" });
    grand.warn("msg2");
    const recs = drain(out);
    expect(recs[0].fields).toEqual({ component: "router", run: "r1", extra: true });
    expect(recs[1].fields).toEqual({ component: "router", run: "r1", tag: "t" });
  });

  it("injects ts from now()", () => {
    const out = new PassThrough();
    let t = 100;
    const log = createLogger({ level: "debug", out, now: () => t++ });
    log.info("a");
    log.info("b");
    log.info("c");
    const recs = drain(out);
    expect(recs.map((r) => r.ts)).toEqual([100, 101, 102]);
  });

  it("serializes Error with cause safely", () => {
    const out = new PassThrough();
    const log = createLogger({ level: "debug", out, now: () => 0 });
    const root = new Error("root cause");
    const wrapped = new Error("wrapper", { cause: root });
    log.error("boom", { err: wrapped });
    const [rec] = drain(out);
    const err = rec.fields?.err as Record<string, unknown>;
    expect(err.name).toBe("Error");
    expect(err.message).toBe("wrapper");
    expect(typeof err.stack).toBe("string");
    const cause = err.cause as Record<string, unknown>;
    expect(cause.message).toBe("root cause");
  });

  it("handles circular object fields without throwing", () => {
    const out = new PassThrough();
    const log = createLogger({ level: "debug", out, now: () => 0 });
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => log.info("circ", { a })).not.toThrow();
    const [rec] = drain(out);
    const af = rec.fields?.a as Record<string, unknown>;
    expect(af.name).toBe("a");
    expect(af.self).toBe("[Circular]");
  });

  it("defaults level to info", () => {
    const out = new PassThrough();
    const log = createLogger({ out, now: () => 0 });
    log.debug("skip");
    log.info("keep");
    const recs = drain(out);
    expect(recs.map((r) => r.level)).toEqual(["info"]);
  });
});
