import { ModelRouter, type ModelRouterOptions } from "./router.js";

export { ModelRouter } from "./router.js";
export { selectProviders, pickPrimary } from "./policy.js";
export type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  ProviderKind,
  Router,
  RouteHints,
  RoutePolicy,
} from "./types.js";

export function createRouter(opts: ModelRouterOptions): ModelRouter {
  return new ModelRouter(opts);
}
