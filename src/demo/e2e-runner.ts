import {
  MessageBus,
  createAgentContext,
} from "../agents/index.js";
import { RouterAgent } from "../agents/router-agent.js";
import { withRouter } from "../agents/context-with-router.js";
import type { AgentMessage } from "../agents/types.js";
import {
  Scheduler,
  type SchedulableAgent,
  type ScheduledTask,
} from "../scheduler/index.js";
import { createDefaultRouter } from "../router/default-router.js";
import type { Router } from "../router/index.js";
import { createCredentialStore } from "../auth/index.js";

export interface RunE2EOptions {
  router?: Router;
  prompt?: string;
  now?: () => number;
}

export type E2EResult =
  | { status: "ok"; text: string }
  | { status: "error"; message: string };

const ROUTER_AGENT_ID = "router";
const CLIENT_ID = "e2e-client";
const TASK_ID = "e2e-task-1";
const MESSAGE_ID = "e2e-msg-1";

export async function runE2E(opts: RunE2EOptions = {}): Promise<E2EResult> {
  const bus = new MessageBus();
  const abort = new AbortController();
  const ctx = createAgentContext({
    bus,
    now: opts.now,
    abort: abort.signal,
  });

  const router =
    opts.router ??
    createDefaultRouter({
      credentials: createCredentialStore({ backend: "env" }),
    });

  const wrappedCtx = withRouter(ctx, router);
  const agent = new RouterAgent(ROUTER_AGENT_ID, wrappedCtx);

  const scheduler = new Scheduler({ now: opts.now });

  // Adapter: RouterAgent (BaseAgent) exposes `stop(): void` and a readonly
  // `state` getter, while SchedulableAgent requires `stop(): Promise<void>`
  // and a writable `state`. Wrap rather than mutate the agent.
  const schedulable: SchedulableAgent = {
    id: agent.id,
    state: agent.state,
    async start() {
      await agent.start();
    },
    async stop() {
      agent.stop();
    },
  };
  scheduler.register(schedulable);

  const prompt = opts.prompt ?? "hello";
  const task: ScheduledTask = {
    id: TASK_ID,
    agentId: schedulable.id,
    runAt: ctx.now(),
    payload: { prompt },
  };

  const reply = new Promise<E2EResult>((resolve) => {
    const unsubscribe = bus.subscribe(CLIENT_ID, (msg: AgentMessage) => {
      if (msg.kind === "completion") {
        const payload = msg.payload as { text?: unknown };
        const text = typeof payload.text === "string" ? payload.text : "";
        unsubscribe();
        resolve({ status: "ok", text });
        return;
      }
      if (msg.kind === "error") {
        const payload = msg.payload as { message?: unknown };
        const message =
          typeof payload.message === "string" ? payload.message : "unknown";
        unsubscribe();
        resolve({ status: "error", message });
      }
    });
  });

  scheduler.enqueue(task);
  await scheduler.tick();

  bus.send({
    id: MESSAGE_ID,
    from: CLIENT_ID,
    to: ROUTER_AGENT_ID,
    kind: "prompt",
    payload: { prompt },
    ts: ctx.now(),
  });

  const result = await reply;

  abort.abort();
  await scheduler.stop();

  return result;
}
