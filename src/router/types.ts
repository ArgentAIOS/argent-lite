export interface CompletionRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  model: string;
  providerId: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export type ProviderKind = "local" | "cloud";

export interface Provider {
  id: string;
  kind: ProviderKind;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
}

export type RoutePolicy = "local-first" | "cloud-first" | "cost" | "manual";

export interface RouteHints {
  preferProviderId?: string;
  preferKind?: ProviderKind;
}

export interface Router {
  route(req: CompletionRequest): Promise<CompletionResponse>;
  register(provider: Provider): void;
}
