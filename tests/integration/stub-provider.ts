import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  ProviderKind,
} from "../../src/router/types.js";

export class StubProvider implements Provider {
  public readonly id: string = "stub";
  public readonly kind: ProviderKind = "local";

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    return {
      text: `stub reply: ${req.prompt}`,
      model: "stub-1",
      providerId: this.id,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
