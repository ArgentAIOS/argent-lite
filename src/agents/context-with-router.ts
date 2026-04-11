import type { AgentContext } from "./agent-context.js";
import type { Router } from "../router/index.js";

export interface AgentContextWithRouter extends AgentContext {
  readonly router: Router;
}

export function withRouter(
  ctx: AgentContext,
  router: Router,
): AgentContextWithRouter {
  return { ...ctx, router };
}
