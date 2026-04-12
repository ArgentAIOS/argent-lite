import type { IntentHandler, IntentRouter } from "./types.js";

export function createIntentRouter(): IntentRouter {
  const handlers: IntentHandler[] = [];

  const priorityOf = (h: IntentHandler): number => h.priority ?? 0;

  return {
    register(handler: IntentHandler): void {
      const p = priorityOf(handler);
      let idx = handlers.length;
      for (let i = 0; i < handlers.length; i += 1) {
        if (priorityOf(handlers[i]!) < p) {
          idx = i;
          break;
        }
      }
      handlers.splice(idx, 0, handler);
    },
    dispatch(msg: unknown): string | undefined {
      for (const h of handlers) {
        if (h.matches(msg)) return h.agentId;
      }
      return undefined;
    },
    list(): IntentHandler[] {
      return handlers.slice();
    },
  };
}
