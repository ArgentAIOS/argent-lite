import { describe, it, expect } from "vitest";
import {
  HailoLiveProvider,
  type HailoProbeResult,
  type HailoRunResult,
} from "../../src/providers/hailo-live.js";
import { HailoUnavailableError } from "../../src/providers/hailo.js";

function makeProbe(result: HailoProbeResult) {
  return async (): Promise<HailoProbeResult> => result;
}

function makeRunCli(result: HailoRunResult) {
  return async (
    _args: string[],
    _input: string,
  ): Promise<HailoRunResult> => result;
}

describe("HailoLiveProvider", () => {
  it("has id 'hailo-live' and kind 'local'", () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/x.hef",
      probe: makeProbe({ present: false }),
      runCli: makeRunCli({ stdout: "", stderr: "", exitCode: 0 }),
    });
    expect(p.id).toBe("hailo-live");
    expect(p.kind).toBe("local");
  });

  it("complete() throws HailoUnavailableError when hardware absent", async () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/x.hef",
      probe: makeProbe({ present: false, error: "hailortcli not installed" }),
      runCli: makeRunCli({ stdout: "", stderr: "", exitCode: 0 }),
    });
    await expect(p.complete({ prompt: "hi" })).rejects.toBeInstanceOf(
      HailoUnavailableError,
    );
    await expect(p.complete({ prompt: "hi" })).rejects.toThrow(
      /hardware not present/,
    );
  });

  it("complete() returns stdout when hardware present and runCli succeeds", async () => {
    let capturedArgs: string[] | null = null;
    let capturedInput: string | null = null;
    const p = new HailoLiveProvider({
      modelPath: "/models/llama3.hef",
      probe: makeProbe({ present: true, deviceId: "dev-1" }),
      runCli: async (args, input) => {
        capturedArgs = args;
        capturedInput = input;
        return { stdout: "hello world", stderr: "", exitCode: 0 };
      },
    });
    const res = await p.complete({ prompt: "hi there" });
    expect(res.text).toBe("hello world");
    expect(res.providerId).toBe("hailo-live");
    expect(res.model).toBe("/models/llama3.hef");
    expect(capturedArgs).toEqual([
      "run",
      "/models/llama3.hef",
      "--input",
      "hi there",
    ]);
    expect(capturedInput).toBe("hi there");
  });

  it("complete() uses req.model when provided", async () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/default.hef",
      probe: makeProbe({ present: true }),
      runCli: makeRunCli({ stdout: "ok", stderr: "", exitCode: 0 }),
    });
    const res = await p.complete({ prompt: "hi", model: "custom-model" });
    expect(res.model).toBe("custom-model");
  });

  it("complete() throws with stderr when runCli exits non-zero", async () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/x.hef",
      probe: makeProbe({ present: true }),
      runCli: makeRunCli({
        stdout: "",
        stderr: "device busy",
        exitCode: 2,
      }),
    });
    await expect(p.complete({ prompt: "hi" })).rejects.toBeInstanceOf(
      HailoUnavailableError,
    );
    await expect(p.complete({ prompt: "hi" })).rejects.toThrow(/device busy/);
    await expect(p.complete({ prompt: "hi" })).rejects.toThrow(/exited 2/);
  });

  it("complete() wraps runCli rejection as HailoUnavailableError", async () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/x.hef",
      probe: makeProbe({ present: true }),
      runCli: async () => {
        throw new Error("spawn ENOENT");
      },
    });
    await expect(p.complete({ prompt: "hi" })).rejects.toBeInstanceOf(
      HailoUnavailableError,
    );
    await expect(p.complete({ prompt: "hi" })).rejects.toThrow(/spawn ENOENT/);
  });

  it("healthCheck() returns false when probe reports absent", async () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/x.hef",
      probe: makeProbe({ present: false }),
      runCli: makeRunCli({ stdout: "", stderr: "", exitCode: 0 }),
    });
    expect(await p.healthCheck()).toBe(false);
  });

  it("healthCheck() returns true when probe reports present", async () => {
    const p = new HailoLiveProvider({
      modelPath: "/models/x.hef",
      probe: makeProbe({ present: true, deviceId: "dev-1" }),
      runCli: makeRunCli({ stdout: "", stderr: "", exitCode: 0 }),
    });
    expect(await p.healthCheck()).toBe(true);
  });
});
