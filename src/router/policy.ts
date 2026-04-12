import type { Provider, RouteHints, RoutePolicy } from "./types.js";

const COST_RANK: Record<string, number> = {
  local: 0,
  cloud: 1,
};

export function selectProviders(
  providers: readonly Provider[],
  policy: RoutePolicy,
  hints: RouteHints = {},
): Provider[] {
  if (providers.length === 0) return [];

  if (policy === "manual") {
    if (hints.preferProviderId) {
      const match = providers.find((p) => p.id === hints.preferProviderId);
      return match ? [match] : [];
    }
    if (hints.preferKind) {
      return providers.filter((p) => p.kind === hints.preferKind);
    }
    return [...providers];
  }

  const sorted = [...providers];

  if (policy === "local-first") {
    sorted.sort((a, b) => rankKind(a, "local") - rankKind(b, "local"));
    return sorted;
  }

  if (policy === "cloud-first") {
    sorted.sort((a, b) => rankKind(a, "cloud") - rankKind(b, "cloud"));
    return sorted;
  }

  // cost: local < cloud, then stable by id.
  sorted.sort((a, b) => {
    const delta = (COST_RANK[a.kind] ?? 99) - (COST_RANK[b.kind] ?? 99);
    if (delta !== 0) return delta;
    return a.id.localeCompare(b.id);
  });
  return sorted;
}

function rankKind(p: Provider, preferred: Provider["kind"]): number {
  return p.kind === preferred ? 0 : 1;
}

export function pickPrimary(
  providers: readonly Provider[],
  policy: RoutePolicy,
  hints: RouteHints = {},
): Provider | undefined {
  return selectProviders(providers, policy, hints)[0];
}
