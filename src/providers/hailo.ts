import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../router/types.js";

export class HailoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HailoUnavailableError";
  }
}

export interface HailoProviderOptions {
  modelPath: string;
  socketPath?: string;
}

export class HailoProvider implements Provider {
  readonly id = "hailo";
  readonly kind = "local" as const;
  readonly modelPath: string;
  readonly socketPath: string;

  constructor(opts: HailoProviderOptions) {
    this.modelPath = opts.modelPath;
    this.socketPath = opts.socketPath ?? "/var/run/hailort.sock";
  }

  async complete(_req: CompletionRequest): Promise<CompletionResponse> {
    throw new HailoUnavailableError(
      "HailoProvider: Hailo-10H not yet initialized",
    );
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}
