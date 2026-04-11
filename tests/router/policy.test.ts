import { describe, it, expect } from "vitest";
import { selectProviders, pickPrimary } from "../../src/router/policy.js";
import type { Provider } from "../../src/router/types.js";

function fakeProvider(id: string, kind: "local" | "cloud"): Provider {
  return {
    id,
    kind,
    async complete() {
      return { text: "", model: "", providerId: id };
    },
    async healthCheck() {
      return true;
    },
  };
}

const local = fakeProvider("ollama", "local");
const cloudA = fakeProvider("anthropic", "cloud");
const cloudB = fakeProvider("openai", "cloud");

describe("selectProviders", () => {
  it("local-first puts local before cloud", () => {
    const order = selectProviders([cloudA, local, cloudB], "local-first");
    expect(order[0]?.kind).toBe("local");
  });

  it("cloud-first puts cloud before local", () => {
    const order = selectProviders([local, cloudA], "cloud-first");
    expect(order[0]?.kind).toBe("cloud");
  });

  it("cost policy prefers local then cloud sorted by id", () => {
    const order = selectProviders([cloudB, cloudA, local], "cost");
    expect(order.map((p) => p.id)).toEqual(["ollama", "anthropic", "openai"]);
  });

  it("manual with preferProviderId returns that provider only", () => {
    const order = selectProviders([local, cloudA, cloudB], "manual", {
      preferProviderId: "anthropic",
    });
    expect(order).toEqual([cloudA]);
  });

  it("manual with preferKind filters by kind", () => {
    const order = selectProviders([local, cloudA, cloudB], "manual", {
      preferKind: "cloud",
    });
    expect(order.map((p) => p.id)).toEqual(["anthropic", "openai"]);
  });

  it("returns empty array when no providers", () => {
    expect(selectProviders([], "local-first")).toEqual([]);
  });

  it("manual with unknown id returns empty", () => {
    expect(
      selectProviders([local], "manual", { preferProviderId: "nope" }),
    ).toEqual([]);
  });
});

describe("pickPrimary", () => {
  it("returns first choice by policy", () => {
    expect(pickPrimary([cloudA, local], "local-first")?.id).toBe("ollama");
  });

  it("returns undefined when list is empty", () => {
    expect(pickPrimary([], "cost")).toBeUndefined();
  });
});
