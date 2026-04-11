export interface IntentHandler {
  agentId: string;
  matches(msg: unknown): boolean;
  priority?: number;
}

export interface IntentRouter {
  register(handler: IntentHandler): void;
  dispatch(msg: unknown): string | undefined;
  list(): IntentHandler[];
}
