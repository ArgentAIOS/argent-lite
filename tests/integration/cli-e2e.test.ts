import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI_PATH = resolve(process.cwd(), "dist/src/cli/index.js");
const OLLAMA_HOST = "http://localhost:11434";
// Ceiling for the live-route test. On a Pi 5 CPU, gemma3:1b first-token
// latency can exceed 2 minutes, so we cap the wait and SKIP rather than
// fail when the local model is too slow to respond in the harness window.
const LIVE_ROUTE_TIMEOUT_MS = 45_000;

type RunResult =
  | { kind: "exit"; code: number | null; stdout: string; stderr: string }
  | { kind: "timeout"; stdout: string; stderr: string };

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolvePromise({ kind: "timeout", stdout, stderr });
      } else {
        resolvePromise({ kind: "exit", code, stdout, stderr });
      }
    });
  });
}

async function ollamaReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 750);
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

describe("cli-e2e", () => {
  it("built CLI artifact exists", () => {
    if (!existsSync(CLI_PATH)) {
      throw new Error(
        `dist/src/cli/index.js not found — run \`pnpm build\` before \`pnpm test:integration\``,
      );
    }
  });

  it("routes through standalone mode end-to-end", async (ctx) => {
    if (!existsSync(CLI_PATH)) {
      ctx.skip();
      return;
    }
    if (!(await ollamaReachable())) {
      console.warn(
        `[cli-e2e] ollama not reachable at ${OLLAMA_HOST} — skipping live route`,
      );
      ctx.skip();
      return;
    }

    const result = await runCli(
      ["ping"],
      {
        ARGENT_MODE: "standalone",
        ANTHROPIC_API_KEY: "",
        OPENAI_API_KEY: "",
      },
      LIVE_ROUTE_TIMEOUT_MS,
    );

    if (result.kind === "timeout") {
      console.warn(
        `[cli-e2e] live CLI route exceeded ${LIVE_ROUTE_TIMEOUT_MS}ms — skipping (slow local model)`,
      );
      ctx.skip();
      return;
    }

    // Router invariants: the CLI either succeeds (0) or fails with the
    // router's own exit code (3). 1/2 indicate a different bug and are
    // not acceptable.
    expect([0, 3]).toContain(result.code);
    if (result.code === 0) {
      expect(result.stdout.trim().length).toBeGreaterThan(0);
    } else {
      expect(result.stderr).toMatch(/\[argent-lite\]/);
    }
  }, LIVE_ROUTE_TIMEOUT_MS + 15_000);
});
