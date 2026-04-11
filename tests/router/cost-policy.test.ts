import { describe, it, expect } from "vitest";
import { selectByCost } from "../../src/router/cost-policy.js";
import type { Provider } from "../../src/router/types.js";

function fakeProvider(id: string, kind: "local" | "cloud" = "cloud"): Provider {
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

const ollama = fakeProvider("ollama", "local");
const anthropic = fakeProvider("anthropic");
const openai = fakeProvider("openai");

describe("selectByCost", () => {
  it("sorts providers by cost ascending", () => {
    const order = selectByCost([anthropic, openai, ollama], {
      costs: [
        { providerId: "anthropic", costPerToken: 0.00003, latencyMsP50: 500 },
        { providerId: "openai", costPerToken: 0.00002, latencyMsP50: 500 },
        { providerId: "ollama", costPerToken: 0, latencyMsP50: 500 },
      ],
    });
    expect(order.map((p) => p.id)).toEqual(["ollama", "openai", "anthropic"]);
  });

  it("breaks ties on latency when costs are equal", () => {
    const order = selectByCost([anthropic, openai], {
      preferLocal: false,
      costs: [
        { providerId: "anthropic", costPerToken: 0.00002, latencyMsP50: 800 },
        { providerId: "openai", costPerToken: 0.00002, latencyMsP50: 300 },
      ],
    });
    expect(order.map((p) => p.id)).toEqual(["openai", "anthropic"]);
  });

  it("preferLocal puts cost-0 first even with worse latency", () => {
    const order = selectByCost([anthropic, ollama], {
      preferLocal: true,
      costs: [
        { providerId: "anthropic", costPerToken: 0.00002, latencyMsP50: 100 },
        { providerId: "ollama", costPerToken: 0, latencyMsP50: 9000 },
      ],
    });
    expect(order[0]?.id).toBe("ollama");
  });

  it("returns empty when no providers given", () => {
    const order = selectByCost([], {
      costs: [{ providerId: "ollama", costPerToken: 0, latencyMsP50: 10 }],
    });
    expect(order).toEqual([]);
  });

  it("omits providers missing a cost entry", () => {
    const order = selectByCost([anthropic, openai], {
      costs: [
        { providerId: "anthropic", costPerToken: 0.00003, latencyMsP50: 500 },
      ],
    });
    expect(order.map((p) => p.id)).toEqual(["anthropic"]);
  });
});
