import { loadMode } from "../config/mode.js";
import { createRouter } from "../router/index.js";
import { OllamaProvider } from "../providers/ollama.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { OpenAIProvider } from "../providers/openai.js";
import { createCredentialStore } from "../auth/index.js";

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const prompt = argv.join(" ").trim();
  if (!prompt) {
    process.stderr.write("usage: argent-lite <prompt>\n");
    return 2;
  }
  const mode = loadMode();
  if (mode === "satellite") {
    process.stderr.write(
      "[argent-lite] Phase 1 satellite stub: behaving as standalone\n",
    );
  }

  const store = createCredentialStore({ backend: "env" });
  const router = createRouter({ policy: "local-first" });
  router.register(new OllamaProvider());
  router.register(
    new AnthropicProvider({ getKey: async () => (await store.get("anthropic")) ?? "" }),
  );
  router.register(
    new OpenAIProvider({ getKey: async () => (await store.get("openai")) ?? "" }),
  );

  try {
    const res = await router.route({ prompt });
    process.stdout.write(`${res.text}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`[argent-lite] ${(err as Error).message}\n`);
    return 3;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`[argent-lite] ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
