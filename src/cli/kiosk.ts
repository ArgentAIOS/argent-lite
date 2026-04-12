import { createKioskHandlers } from "../kiosk/handlers.js";
import { startKioskServer } from "../kiosk/server.js";

export async function runKiosk(
  _argv: string[] = process.argv.slice(2),
): Promise<number> {
  const handlers = createKioskHandlers({
    async startCapture() {
      process.stdout.write("[kiosk] mic capture not wired yet\n");
    },
    async stopCapture() {
      process.stdout.write("[kiosk] mic capture not wired yet\n");
      return undefined;
    },
    async cancelSpeech() {
      process.stdout.write("[kiosk] speech cancel not wired yet\n");
    },
  });

  const server = await startKioskServer({ handlers, port: 7788 });
  process.stdout.write(`listening on http://127.0.0.1:${server.port}\n`);

  await new Promise<void>((resolvePromise) => {
    const onSig = (): void => {
      process.off("SIGINT", onSig);
      process.off("SIGTERM", onSig);
      resolvePromise();
    };
    process.on("SIGINT", onSig);
    process.on("SIGTERM", onSig);
  });

  await server.stop();
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runKiosk().then(
    (code) => process.exit(code),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[argent-lite-kiosk] ${msg}\n`);
      process.exit(1);
    },
  );
}
