import { describe, it, expect } from "vitest";
import {
  EVENT_KINDS,
  isEventKind,
  assertEventKind,
} from "../../src/runtime/event-kinds.js";

describe("event-kinds vocabulary", () => {
  it("locks to exactly the 5 approved kinds", () => {
    expect([...EVENT_KINDS]).toEqual([
      "channel.in",
      "channel.out",
      "router.in",
      "router.out",
      "agent.error",
    ]);
    expect(EVENT_KINDS).toHaveLength(5);
  });

  it("isEventKind returns true for each approved kind", () => {
    for (const kind of EVENT_KINDS) {
      expect(isEventKind(kind)).toBe(true);
    }
  });

  it("isEventKind returns false for unknown kinds", () => {
    for (const bogus of [
      "",
      "channel",
      "channel.IN",
      "channel.in ",
      "router.error",
      "agent.in",
      "agent.out",
      "memory.write",
      "scheduler.tick",
    ]) {
      expect(isEventKind(bogus)).toBe(false);
    }
  });

  it("assertEventKind throws on invalid kinds", () => {
    expect(() => assertEventKind("nope")).toThrow(/invalid event kind: nope/);
    expect(() => assertEventKind("")).toThrow(/invalid event kind:/);
  });

  it("assertEventKind passes on valid kinds", () => {
    for (const kind of EVENT_KINDS) {
      expect(() => assertEventKind(kind)).not.toThrow();
    }
  });

  it("rejects the pre-lock draft kinds router.route and router.error (2026-04-11 reconcile)", () => {
    expect(isEventKind("router.route")).toBe(false);
    expect(isEventKind("router.error")).toBe(false);
    expect(() => assertEventKind("router.route")).toThrow(
      /invalid event kind: router\.route/,
    );
    expect(() => assertEventKind("router.error")).toThrow(
      /invalid event kind: router\.error/,
    );
  });

  it("EVENT_KINDS is frozen at runtime", () => {
    expect(Object.isFrozen(EVENT_KINDS)).toBe(true);
    const arr = EVENT_KINDS as unknown as string[];
    expect(() => arr.push("evil.kind")).toThrow(TypeError);
    expect(() => {
      arr[0] = "mutated.kind";
    }).toThrow(TypeError);
    expect(EVENT_KINDS).toHaveLength(5);
    expect(EVENT_KINDS[0]).toBe("channel.in");
  });
});
