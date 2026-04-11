export type ProviderId = "anthropic" | "openai" | "ollama";

export type CredentialBackend = "file" | "env";

export interface CredentialStore {
  get(providerId: string): Promise<string | undefined>;
  set(providerId: string, secret: string): Promise<void>;
  list(): Promise<string[]>;
  remove(providerId: string): Promise<void>;
}

export interface CredentialStoreOptions {
  backend?: CredentialBackend;
  filePath?: string;
  env?: NodeJS.ProcessEnv;
}

export class UnsupportedOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedOperationError";
  }
}

export class CredentialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialStoreError";
  }
}

export const PROVIDER_ENV_MAP: Readonly<Record<ProviderId, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  ollama: "OLLAMA_API_KEY",
};

export const KNOWN_PROVIDERS: ReadonlyArray<ProviderId> = [
  "anthropic",
  "openai",
  "ollama",
];
