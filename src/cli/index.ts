import { loadMode, type RuntimeMode } from "../config/mode.js";

interface RouteResponseLike {
  text: string;
  provider: string;
}

interface RouterLike {
  route(req: {
    prompt: string;
    mode: RuntimeMode;
  }): Promise<RouteResponseLike>;
}

async function loadRouter(): Promise<RouterLike | undefined> {
  try {
    const mod: { createRouter?: () => RouterLike } = await import(
      "../router/index.js"
    );
    return mod.createRouter?.();
  } catch {
    return undefined;
  }
}

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
  const router = await loadRouter();
  if (!router) {
    process.stderr.write(
      "[argent-lite] router not available on this branch (cli-scaffold)\n",
    );
    return 3;
  }
  const res = await router.route({ prompt, mode });
  process.stdout.write(`${res.text}\n`);
  return 0;
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
