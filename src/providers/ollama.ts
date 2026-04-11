import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../router/types.js";

export interface OllamaProviderOptions {
  id?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
}

interface OllamaGenerateResponse {
  response?: string;
  model?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements Provider {
  readonly id: string;
  readonly kind = "local" as const;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OllamaProviderOptions = {}) {
    this.id = opts.id ?? "ollama";
    this.baseUrl = opts.baseUrl ?? "http://localhost:11434";
    this.defaultModel = opts.defaultModel ?? "gemma3:1b";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      prompt: req.prompt,
      stream: false,
    };
    const options: Record<string, unknown> = {};
    if (req.temperature !== undefined) options.temperature = req.temperature;
    if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
    if (Object.keys(options).length > 0) body.options = options;

    const res = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`OllamaProvider: HTTP ${res.status}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    return {
      text: data.response ?? "",
      model: data.model ?? model,
      providerId: this.id,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/tags`, {
        method: "GET",
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
