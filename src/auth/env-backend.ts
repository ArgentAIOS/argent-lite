import {
  CredentialStore,
  KNOWN_PROVIDERS,
  PROVIDER_ENV_MAP,
  ProviderId,
  UnsupportedOperationError,
} from "./types.js";

export interface EnvBackendOptions {
  env?: NodeJS.ProcessEnv;
}

function isKnownProvider(id: string): id is ProviderId {
  return (KNOWN_PROVIDERS as ReadonlyArray<string>).includes(id);
}

export function createEnvBackend(options: EnvBackendOptions = {}): CredentialStore {
  const env = options.env ?? process.env;

  return {
    async get(providerId: string): Promise<string | undefined> {
      if (!isKnownProvider(providerId)) return undefined;
      const varName = PROVIDER_ENV_MAP[providerId];
      const value = env[varName];
      return value && value.length > 0 ? value : undefined;
    },

    async set(_providerId: string, _secret: string): Promise<void> {
      throw new UnsupportedOperationError(
        "env backend is read-only; environment variables cannot be mutated at runtime. " +
          "Use the file backend (ARGENT_MASTER_KEY) to persist secrets.",
      );
    },

    async list(): Promise<string[]> {
      const present: string[] = [];
      for (const providerId of KNOWN_PROVIDERS) {
        const value = env[PROVIDER_ENV_MAP[providerId]];
        if (value && value.length > 0) present.push(providerId);
      }
      return present;
    },

    async remove(_providerId: string): Promise<void> {
      throw new UnsupportedOperationError(
        "env backend is read-only; cannot remove environment variables at runtime.",
      );
    },
  };
}
