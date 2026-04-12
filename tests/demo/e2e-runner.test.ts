import { describe, expect, it } from "vitest";
import { runE2E } from "../../src/demo/e2e-runner.js";
import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  Router,
} from "../../src/router/index.js";

describe("runE2E", () => {
  it("boots, enqueues, routes through injected router, and returns ok", async () => {
    const seen: CompletionRequest[] = [];
    const mockRouter: Router = {
      async route(req: CompletionRequest): Promise<CompletionResponse> {
        seen.push(req);
        return { text: "mocked", model: "m", providerId: "mock" };
      },
      register(_p: Provider): void {},
    };

    const result = await runE2E({ router: mockRouter, prompt: "hi there" });

    expect(result).toEqual({ status: "ok", text: "mocked" });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.prompt).toBe("hi there");
  });
});
