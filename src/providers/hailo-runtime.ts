import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface HailoProbeResult {
  present: boolean;
  deviceId?: string;
  firmware?: string;
  error?: string;
}

interface ExecError extends Error {
  code?: string | number;
  stdout?: string;
  stderr?: string;
}

function parseIdentifyOutput(stdout: string): {
  deviceId?: string;
  firmware?: string;
} {
  const result: { deviceId?: string; firmware?: string } = {};
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!value) continue;
    if (
      result.deviceId === undefined &&
      (key === "device id" || key === "board name" || key === "serial number")
    ) {
      result.deviceId = value;
    } else if (
      result.firmware === undefined &&
      (key === "firmware version" || key === "fw version")
    ) {
      result.firmware = value;
    }
  }
  return result;
}

export async function probeHailo(): Promise<HailoProbeResult> {
  try {
    const { stdout } = await execFileAsync("hailortcli", [
      "fw-control",
      "identify",
    ]);
    const parsed = parseIdentifyOutput(stdout);
    return {
      present: true,
      ...(parsed.deviceId !== undefined ? { deviceId: parsed.deviceId } : {}),
      ...(parsed.firmware !== undefined ? { firmware: parsed.firmware } : {}),
    };
  } catch (err) {
    const e = err as ExecError;
    if (e.code === "ENOENT") {
      return {
        present: false,
        error: "hailortcli not installed",
      };
    }
    const message =
      (e.stderr && e.stderr.trim()) ||
      (e.stdout && e.stdout.trim()) ||
      e.message ||
      "unknown error";
    return { present: false, error: message };
  }
}
