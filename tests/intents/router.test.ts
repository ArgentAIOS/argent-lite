import { describe, it, expect } from "vitest";
import { createIntentRouter } from "../../src/intents/index.js";
import type { IntentHandler } from "../../src/intents/index.js";

interface TextMsg {
  kind: string;
  text?: string;
}

const isObject = (m: unknown): m is TextMsg =>
  typeof m === "object" && m !== null && "kind" in (m as Record<string, unknown>);

describe("intent router", () => {
  it("dispatches to different handlers by matcher", () => {
    const router = createIntentRouter();
    const a: IntentHandler = {
      agentId: "agent-a",
      matches: (m) => isObject(m) && m.kind === "a",
    };
    const b: IntentHandler = {
      agentId: "agent-b",
      matches: (m) => isObject(m) && m.kind === "b",
    };
    router.register(a);
    router.register(b);

    expect(router.dispatch({ kind: "a" })).toBe("agent-a");
    expect(router.dispatch({ kind: "b" })).toBe("agent-b");
  });

  it("higher priority wins regardless of registration order", () => {
    const router = createIntentRouter();
    const low: IntentHandler = {
      agentId: "low",
      matches: () => true,
      priority: 1,
    };
    const high: IntentHandler = {
      agentId: "high",
      matches: () => true,
      priority: 10,
    };
    router.register(low);
    router.register(high);

    expect(router.dispatch({ kind: "whatever" })).toBe("high");
  });

  it("equal priority falls back to registration order", () => {
    const router = createIntentRouter();
    const first: IntentHandler = {
      agentId: "first",
      matches: () => true,
      priority: 5,
    };
    const second: IntentHandler = {
      agentId: "second",
      matches: () => true,
      priority: 5,
    };
    router.register(first);
    router.register(second);

    expect(router.dispatch({ kind: "x" })).toBe("first");
  });

  it("returns undefined when nothing matches", () => {
    const router = createIntentRouter();
    router.register({
      agentId: "only",
      matches: (m) => isObject(m) && m.kind === "never",
    });
    expect(router.dispatch({ kind: "other" })).toBeUndefined();
  });

  it("list() returns a copy that does not leak mutations", () => {
    const router = createIntentRouter();
    const h: IntentHandler = { agentId: "a", matches: () => true };
    router.register(h);

    const snapshot = router.list();
    snapshot.pop();
    snapshot.push({ agentId: "injected", matches: () => true });

    const after = router.list();
    expect(after).toHaveLength(1);
    expect(after[0]?.agentId).toBe("a");
  });
});
