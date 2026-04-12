import { createEnvBackend } from "./env-backend.js";
import { createFileBackend } from "./file-backend.js";
import {
  CredentialBackend,
  CredentialStore,
  CredentialStoreOptions,
} from "./types.js";

export function createCredentialStore(
  options: CredentialStoreOptions = {},
): CredentialStore {
  const backend: CredentialBackend = options.backend ?? "env";

  switch (backend) {
    case "file":
      return createFileBackend({ filePath: options.filePath, env: options.env });
    case "env":
      return createEnvBackend({ env: options.env });
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unknown credential backend: ${String(exhaustive)}`);
    }
  }
}
