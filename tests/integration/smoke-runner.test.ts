import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = resolve(
  new URL("../../", import.meta.url).pathname,
  "scripts/phase3-smoke.sh",
);

const scriptExists =
  existsSync(SCRIPT_PATH) && statSync(SCRIPT_PATH).isFile();

describe.skipIf(!scriptExists)("phase3-smoke.sh", () => {
  it(
    "runs end-to-end and exits 0",
    async () => {
      const { stdout, stderr } = await execFileAsync("bash", [SCRIPT_PATH], {
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      });
      const combined = `${stdout}\n${stderr}`;
      expect(combined).toContain("[phase3-smoke] smoke passed");
      expect(combined).toMatch(/PASS: channel\.in=\d+, channel\.out=\d+/);
    },
    120_000,
  );
});
