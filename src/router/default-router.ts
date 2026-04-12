import { ModelRouter } from "./router.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { OllamaProvider } from "../providers/ollama.js";
import { OpenAIProvider } from "../providers/openai.js";
import type { CredentialStore } from "../auth/types.js";

export interface CreateDefaultRouterOptions {
  credentials: CredentialStore;
  ollamaBaseUrl?: string;
  anthropicBaseUrl?: string;
  openaiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createDefaultRouter(
  opts: CreateDefaultRouterOptions,
): ModelRouter {
  const router = new ModelRouter({ policy: "local-first" });

  router.register(
    new OllamaProvider({
      baseUrl: opts.ollamaBaseUrl,
      fetchImpl: opts.fetchImpl,
    }),
  );

  router.register(
    new AnthropicProvider({
      baseUrl: opts.anthropicBaseUrl,
      fetchImpl: opts.fetchImpl,
      getKey: async () => {
        const key = await opts.credentials.get("anthropic");
        if (!key) {
          throw new Error(
            "createDefaultRouter: missing credential for 'anthropic'",
          );
        }
        return key;
      },
    }),
  );

  router.register(
    new OpenAIProvider({
      baseUrl: opts.openaiBaseUrl,
      fetchImpl: opts.fetchImpl,
      getKey: async () => {
        const key = await opts.credentials.get("openai");
        if (!key) {
          throw new Error(
            "createDefaultRouter: missing credential for 'openai'",
          );
        }
        return key;
      },
    }),
  );

  return router;
}
