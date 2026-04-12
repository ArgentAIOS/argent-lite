import { bootRuntime, type Runtime } from "../integration/runtime.js";

/**
 * Long-running daemon entry point.
 *
 * Unlike `chat.ts` — which reads stdin and exits on EOF — this boots the
 * runtime and waits until SIGTERM or SIGINT. Suitable for systemd
 * `Type=simple` units where stdin is piped from /dev/null.
 *
 * Channels are NOT wired by default. A future slice should add an
 * `ARGENT_CHANNELS=http,file-watch` env var that selects channels at
 * boot so the daemon has real input sources while running under
 * systemd. For now it sits idle, serving only the metrics and memory
 * audit trail — enough for the UI launcher to see a running pid.
 */
export async function runDaemon(
  _argv: string[] = process.argv.slice(2),
): Promise<number> {
  const runtime: Runtime = await bootRuntime({
    memoryPath: process.env.ARGENT_HOME
      ? `${process.env.ARGENT_HOME}/memory.sqlite`
      : undefined,
  });

  process.stderr.write("[argent-lite] daemon ready\n");

  let shuttingDown = false;
  const onSignal = (sig: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stderr.write(`[argent-lite] ${sig} received, shutting down\n`);
    runtime
      .shutdown()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        process.stderr.write(
          `[argent-lite] shutdown error: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
        process.exit(1);
      });
  };

  // Keep Node's event loop busy. An unresolved promise is NOT enough —
  // Node exits when the loop has no pending I/O or timers. A long-interval
  // setInterval is the minimal keep-alive; it's cleared on shutdown.
  const keepAlive = setInterval(() => {
    /* intentional no-op */
  }, 1 << 30);

  const originalOnSignal = onSignal;
  const onSignalWithCleanup = (sig: NodeJS.Signals): void => {
    clearInterval(keepAlive);
    originalOnSignal(sig);
  };

  process.on("SIGTERM", onSignalWithCleanup);
  process.on("SIGINT", onSignalWithCleanup);

  // Block until a signal fires (onSignalWithCleanup calls process.exit).
  await new Promise<void>(() => {
    /* never resolves — exit happens via signal handler */
  });

  return 0;
}

const invokedAsScript =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedAsScript) {
  runDaemon().catch((err: unknown) => {
    process.stderr.write(
      `[argent-lite] daemon failed: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    process.exit(1);
  });
}
