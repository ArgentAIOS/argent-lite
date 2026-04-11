import { describe, it, expect, beforeEach, vi } from "vitest";

type ExecCallback = (
  err: (Error & { code?: string | number }) | null,
  result?: { stdout: string; stderr: string },
) => void;

const execState = vi.hoisted(() => ({
  impl: null as
    | null
    | ((file: string, args: readonly string[], cb: ExecCallback) => void),
}));

vi.mock("node:child_process", () => ({
  execFile: (
    file: string,
    args: readonly string[],
    cb: ExecCallback,
  ): void => {
    if (!execState.impl) {
      throw new Error("execFile mock not configured");
    }
    execState.impl(file, args, cb);
  },
}));

const SAMPLE_IDENTIFY_OUTPUT = `Executing on device: 0000:01:00.0
Identifying board
Control Protocol Version: 2
Firmware Version: 4.17.0 (release,app,extended context switch buffer)
Logger Version: 0
Board Name: Hailo-10H
Device Architecture: HAILO10H
Serial Number: HLDDLBB243600123
Part Number: HM21LB1C2LAE
Product Name: HAILO-10H AI ACC M.2 B+M KEY MODULE
`;

describe("probeHailo", () => {
  beforeEach(() => {
    execState.impl = null;
  });

  it("returns present=true with parsed deviceId and firmware on success", async () => {
    execState.impl = (file, args, cb) => {
      expect(file).toBe("hailortcli");
      expect(args).toEqual(["fw-control", "identify"]);
      cb(null, { stdout: SAMPLE_IDENTIFY_OUTPUT, stderr: "" });
    };

    const { probeHailo } = await import("../../src/providers/hailo-runtime.js");
    const result = await probeHailo();

    expect(result.present).toBe(true);
    expect(result.deviceId).toBe("Hailo-10H");
    expect(result.firmware).toBe(
      "4.17.0 (release,app,extended context switch buffer)",
    );
    expect(result.error).toBeUndefined();
  });

  it("returns present=false with error when hailortcli is missing (ENOENT)", async () => {
    execState.impl = (_file, _args, cb) => {
      const err = Object.assign(new Error("spawn hailortcli ENOENT"), {
        code: "ENOENT",
      });
      cb(err);
    };

    const { probeHailo } = await import("../../src/providers/hailo-runtime.js");
    const result = await probeHailo();

    expect(result.present).toBe(false);
    expect(result.deviceId).toBeUndefined();
    expect(result.firmware).toBeUndefined();
    expect(result.error).toBe("hailortcli not installed");
  });
});
