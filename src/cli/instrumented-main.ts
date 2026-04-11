import { createLogger } from "../obs/logger.js";
import { createMetrics, type Metrics } from "../obs/metrics.js";
import type { Logger } from "../obs/types.js";
import { createDefaultRouter } from "../router/default-router.js";
import { instrumentRouter } from "../router/instrumented-router.js";
import type { Router } from "../router/types.js";
import { createCredentialStore } from "../auth/credential-store.js";
import type { CredentialStore } from "../auth/types.js";

export interface InstrumentedMainOptions {
  routerOverride?: Router;
  logger?: Logger;
  metrics?: Metrics;
  credentials?: CredentialStore;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

export async function instrumentedMain(
  argv: string[] = process.argv.slice(2),
  opts: InstrumentedMainOptions = {},
): Promise<number> {
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const logger = opts.logger ?? createLogger({ level: "info" });
  const metrics = opts.metrics ?? createMetrics();

  const prompt = argv.join(" ").trim();
  if (!prompt) {
    stderr.write("usage: argent-lite-instrumented <prompt>\n");
    return 2;
  }

  const inner =
    opts.routerOverride ??
    createDefaultRouter({
      credentials: opts.credentials ?? createCredentialStore({ backend: "env" }),
    });

  const router = instrumentRouter({ inner, metrics, logger });

  let exitCode: number;
  try {
    const res = await router.route({ prompt });
    stdout.write(`${res.text}\n`);
    exitCode = 0;
  } catch (err) {
    stderr.write(`[argent-lite] ${(err as Error).message}\n`);
    exitCode = 3;
  }

  const snap = metrics.snapshot();
  const totalCounter = snap.counters.find(
    (c) => c.name === "router.route.total",
  );
  const successCounter = snap.counters.find(
    (c) => c.name === "router.route.success",
  );
  const failureCounter = snap.counters.find(
    (c) => c.name === "router.route.failure",
  );
  const latency = snap.histograms.find(
    (h) => h.name === "router.route.latency_ms",
  );

  logger.info("instrumented-main.summary", {
    total: totalCounter?.value ?? 0,
    success: successCounter?.value ?? 0,
    failure: failureCounter?.value ?? 0,
    latency_ms: latency
      ? { count: latency.count, p50: latency.p50, p95: latency.p95 }
      : { count: 0, p50: 0, p95: 0 },
    exit_code: exitCode,
  });

  return exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  instrumentedMain().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`[argent-lite] ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
