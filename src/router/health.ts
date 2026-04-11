import type { Provider } from "./types.js";

export interface ProviderHealth {
  providerId: string;
  healthy: boolean;
  latencyMs: number;
}

export interface ProviderRegistry {
  list(): Provider[];
}

export type Clock = () => number;

export async function routerHealth(
  router: ProviderRegistry,
  clock: Clock = () => Date.now(),
): Promise<ProviderHealth[]> {
  const providers = router.list();
  return Promise.all(
    providers.map(async (provider) => {
      const start = clock();
      let healthy = false;
      try {
        healthy = await provider.healthCheck();
      } catch {
        healthy = false;
      }
      const latencyMs = clock() - start;
      return { providerId: provider.id, healthy, latencyMs };
    }),
  );
}
