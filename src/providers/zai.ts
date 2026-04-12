import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from "../router/types.js";

/**
 * Z.AI has two distinct endpoints with different billing and allowed
 * use cases. The caller MUST state which plan the key belongs to —
 * there is no auto-detect, and mixing them up triggers either
 * HTTP 429 "Insufficient balance" or silent policy rejection.
 *
 * - "coder": GLM Coding Plan subscription, coding-scenario only.
 *            https://api.z.ai/api/coding/paas/v4/chat/completions
 * - "api":   General PaaS API, pay-as-you-go.
 *            https://api.z.ai/api/paas/v4/chat/completions
 *
 * Both endpoints are OpenAI chat/completions wire-compatible.
 * GLM models run reasoning tokens by default, so max_tokens should
 * be generous (≥256) to avoid empty content frames.
 */
export type ZaiPlan = "coder" | "api";

export interface ZaiProviderOptions {
  plan: ZaiPlan;
  getKey: () => string | Promise<string>;
  id?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  defaultMaxTokens?: number;
}

interface ZaiChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function completionsUrl(plan: ZaiPlan): string {
  switch (plan) {
    case "coder":
      return "https://api.z.ai/api/coding/paas/v4/chat/completions";
    case "api":
      return "https://api.z.ai/api/paas/v4/chat/completions";
  }
}

export class ZaiProvider implements Provider {
  readonly id: string;
  readonly kind = "cloud" as const;
  readonly plan: ZaiPlan;
  private readonly url: string;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly getKey: () => string | Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ZaiProviderOptions) {
    this.plan = opts.plan;
    this.url = completionsUrl(opts.plan);
    this.id = opts.id ?? (opts.plan === "coder" ? "zai-coder" : "zai-api");
    this.defaultModel = opts.defaultModel ?? "glm-4.6";
    this.defaultMaxTokens = opts.defaultMaxTokens ?? 1024;
    this.getKey = opts.getKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.model ?? this.defaultModel;
    const key = await this.getKey();
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: req.prompt }],
      max_tokens: req.maxTokens ?? this.defaultMaxTokens,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`ZaiProvider(${this.plan}): HTTP ${res.status}`);
    }

    const data = (await res.json()) as ZaiChatResponse;
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
