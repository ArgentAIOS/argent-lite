import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../router/types.js";
import { HailoUnavailableError } from "./hailo.js";

export interface HailoProbeResult {
  present: boolean;
  deviceId?: string;
  firmware?: string;
  error?: string;
}

export interface HailoRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type HailoProbeFn = () => Promise<HailoProbeResult>;
export type HailoRunCliFn = (
  args: string[],
  input: string,
) => Promise<HailoRunResult>;

export interface HailoLiveProviderOptions {
  modelPath: string;
  probe?: HailoProbeFn;
  runCli?: HailoRunCliFn;
}

async function defaultProbe(): Promise<HailoProbeResult> {
  const mod = await import("./hailo-runtime.js");
  return mod.probeHailo();
}

async function defaultRunCli(
  args: string[],
  input: string,
): Promise<HailoRunResult> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn("hailortcli", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      reject(err);
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
    child.stdin.end(input);
  });
}

export class HailoLiveProvider implements Provider {
  readonly id = "hailo-live";
  readonly kind = "local" as const;
  readonly modelPath: string;
  private readonly probe: HailoProbeFn;
  private readonly runCli: HailoRunCliFn;

  constructor(opts: HailoLiveProviderOptions) {
    this.modelPath = opts.modelPath;
    this.probe = opts.probe ?? defaultProbe;
    this.runCli = opts.runCli ?? defaultRunCli;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const probeResult = await this.probe();
    if (!probeResult.present) {
      throw new HailoUnavailableError(
        `HailoLiveProvider: hardware not present${
          probeResult.error ? ` (${probeResult.error})` : ""
        }`,
      );
    }
    let result: HailoRunResult;
    try {
      result = await this.runCli(
        ["run", this.modelPath, "--input", req.prompt],
        req.prompt,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HailoUnavailableError(
        `HailoLiveProvider: hailortcli invocation failed (${message})`,
      );
    }
    if (result.exitCode !== 0) {
      throw new HailoUnavailableError(
        `HailoLiveProvider: hailortcli exited ${result.exitCode}: ${result.stderr.trim()}`,
      );
    }
    return {
      text: result.stdout,
      model: req.model ?? this.modelPath,
      providerId: this.id,
    };
  }

  async healthCheck(): Promise<boolean> {
    const probeResult = await this.probe();
    return probeResult.present;
  }
}
