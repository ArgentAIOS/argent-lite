import type { Provider } from "./types.js";

export interface ProviderCost {
  providerId: string;
  costPerToken: number;
  latencyMsP50: number;
}

export interface CostPolicyOptions {
  costs: ProviderCost[];
  maxTokensBudget?: number;
  preferLocal?: boolean;
}

interface Ranked {
  provider: Provider;
  cost: ProviderCost;
}

export function selectByCost(
  providers: readonly Provider[],
  policy: CostPolicyOptions,
): Provider[] {
  if (providers.length === 0) return [];

  const costById = new Map<string, ProviderCost>();
  for (const c of policy.costs) {
    costById.set(c.providerId, c);
  }

  const ranked: Ranked[] = [];
  for (const provider of providers) {
    const cost = costById.get(provider.id);
    if (!cost) continue;
    ranked.push({ provider, cost });
  }

  const preferLocal = policy.preferLocal ?? true;

  ranked.sort((a, b) => {
    if (preferLocal) {
      const aLocal = a.cost.costPerToken === 0 ? 0 : 1;
      const bLocal = b.cost.costPerToken === 0 ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
    }
    if (a.cost.costPerToken !== b.cost.costPerToken) {
      return a.cost.costPerToken - b.cost.costPerToken;
    }
    if (a.cost.latencyMsP50 !== b.cost.latencyMsP50) {
      return a.cost.latencyMsP50 - b.cost.latencyMsP50;
    }
    return a.provider.id.localeCompare(b.provider.id);
  });

  return ranked.map((r) => r.provider);
}
