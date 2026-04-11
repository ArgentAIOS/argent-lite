import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../router/types.js";

export interface AnthropicProviderOptions {
  id?: string;
  baseUrl?: string;
  defaultModel?: string;
  apiVersion?: string;
  getKey: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider implements Provider {
  readonly id: string;
  readonly kind = "cloud" as const;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly apiVersion: string;
  private readonly getKey: () => string | Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AnthropicProviderOptions) {
    this.id = opts.id ?? "anthropic";
    this.baseUrl = opts.baseUrl ?? "https://api.anthropic.com";
    this.defaultModel = opts.defaultModel ?? "claude-haiku-4-5-20251001";
    this.apiVersion = opts.apiVersion ?? "2023-06-01";
    this.getKey = opts.getKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.model ?? this.defaultModel;
    const key = await this.getKey();
    const body = {
      model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature,
      messages: [{ role: "user", content: req.prompt }],
    };

    const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`AnthropicProvider: HTTP ${res.status}`);
    }

    const data = (await res.json()) as AnthropicMessagesResponse;
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");

    return {
      text,
      model: data.model ?? model,
      providerId: this.id,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const key = await this.getKey();
      return typeof key === "string" && key.length > 0;
    } catch {
      return false;
    }
  }
}
