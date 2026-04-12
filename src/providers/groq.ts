import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../router/types.js";

export interface GroqProviderOptions {
  id?: string;
  baseUrl?: string;
  defaultModel?: string;
  getKey: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
}

interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class GroqProvider implements Provider {
  readonly id: string;
  readonly kind = "cloud" as const;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly getKey: () => string | Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GroqProviderOptions) {
    this.id = opts.id ?? "groq";
    this.baseUrl = opts.baseUrl ?? "https://api.groq.com";
    this.defaultModel = opts.defaultModel ?? "llama-3.1-8b-instant";
    this.getKey = opts.getKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.model ?? this.defaultModel;
    const key = await this.getKey();
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: req.prompt }],
    };
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const res = await this.fetchImpl(
      `${this.baseUrl}/openai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new Error(`GroqProvider: HTTP ${res.status}`);
    }

    const data = (await res.json()) as GroqChatResponse;
    const text = data.choices?.[0]?.message?.content ?? "";

    return {
      text,
      model: data.model ?? model,
      providerId: this.id,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
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
