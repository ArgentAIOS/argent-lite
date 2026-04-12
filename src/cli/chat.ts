import { bootRuntime } from "../integration/runtime.js";

export async function runChat(
  _argv: string[] = process.argv.slice(2),
): Promise<number> {
  const runtime = await bootRuntime({
    stdin: process.stdin,
    stdout: process.stdout,
  });

  let shuttingDown = false;
  const onSigint = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
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
  process.on("SIGINT", onSigint);

  await new Promise<void>((resolve) => {
    process.stdin.once("end", () => resolve());
    process.stdin.once("close", () => resolve());
  });

  process.off("SIGINT", onSigint);
  if (!shuttingDown) {
    await runtime.shutdown();
  }
  return 0;
}
