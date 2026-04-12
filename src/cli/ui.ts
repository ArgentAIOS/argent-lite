import { execFile, spawn } from "node:child_process";
import {
  createUiHandlers,
  type BrowserOpener,
  type SystemctlRunner,
} from "../ui/handlers.js";
import { startUiServer } from "../ui/server.js";

function createSystemctlRunner(): SystemctlRunner {
  return {
    run(cmd, unit) {
      return new Promise((resolvePromise) => {
        execFile(
          "systemctl",
          ["--user", cmd, unit],
          { timeout: 10_000 },
          (err, stdout, stderr) => {
            const code =
              err && typeof (err as NodeJS.ErrnoException).code === "number"
                ? ((err as unknown as { code: number }).code)
                : err
                  ? 1
                  : 0;
            resolvePromise({
              code,
              stdout: stdout.toString(),
              stderr: stderr.toString(),
            });
          },
        );
      });
    },
    status(unit) {
      return new Promise((resolvePromise) => {
        execFile(
          "systemctl",
          [
            "--user",
            "show",
            unit,
            "--property=ActiveState,MainPID,ExecMainStartTimestampMonotonic,Result",
          ],
          { timeout: 10_000 },
          (err, stdout) => {
            if (err) {
              resolvePromise({ running: false, lastError: err.message });
              return;
            }
            const fields = new Map<string, string>();
            for (const line of stdout.toString().split("\n")) {
              const idx = line.indexOf("=");
              if (idx > 0) fields.set(line.slice(0, idx), line.slice(idx + 1));
            }
            const running = fields.get("ActiveState") === "active";
            const pidRaw = fields.get("MainPID");
            const pid = pidRaw && pidRaw !== "0" ? Number(pidRaw) : undefined;
            const lastError =
              fields.get("Result") && fields.get("Result") !== "success"
                ? fields.get("Result")
                : undefined;
            resolvePromise({ running, pid, lastError });
          },
        );
      });
    },
  };
}

function createBrowserOpener(): BrowserOpener {
  return {
    open(url) {
      return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn("xdg-open", [url], {
          detached: true,
          stdio: "ignore",
        });
        child.once("error", rejectPromise);
        child.unref();
        resolvePromise();
      });
    },
  };
}

export async function runUi(
  _argv: string[] = process.argv.slice(2),
): Promise<number> {
  const handlers = createUiHandlers({
    systemctl: createSystemctlRunner(),
    browser: createBrowserOpener(),
  });
  const server = await startUiServer({ handlers });
  process.stdout.write(`listening on http://127.0.0.1:${server.port}\n`);

  await new Promise<void>((resolvePromise) => {
    const onSig = () => {
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
  runUi().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`[argent-lite-ui] ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
