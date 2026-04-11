import { ModelRouter } from "../router/router.js";
import { withMemoryLog } from "../router/memory-router.js";
import { instrumentRouter } from "../router/instrumented-router.js";
import { createLogger } from "../obs/logger.js";
import { createMetrics } from "../obs/metrics.js";
import { MessageBus } from "../agents/message-bus.js";
import { createAgentContext } from "../agents/agent-context.js";
import { withRouter } from "../agents/context-with-router.js";
import { RouterAgent } from "../agents/router-agent.js";
import { createIntentRouter } from "../intents/router.js";
import { CliStdioChannel } from "../channels/cli-stdio.js";
import { Scheduler } from "../scheduler/scheduler.js";
import { createMemoryStore } from "../memory/store.js";
import type {
  MemoryEvent,
  MemoryQueryOpts,
  MemoryStore,
} from "../memory/types.js";
import type { Provider, Router } from "../router/types.js";
import type { CredentialStore } from "../auth/index.js";
import type { AgentMessage } from "../agents/types.js";
import type { Readable, Writable } from "node:stream";
import type { SchedulableAgent } from "../scheduler/types.js";

export interface RuntimeOptions {
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  memoryPath?: string;
  providers?: Provider[];
  credentials?: CredentialStore;
  now?: () => number;
}

export interface Runtime {
  shutdown(): Promise<void>;
  memory: MemoryStore;
  router: Router;
  scheduler: Scheduler;
}

const ALLOWED_EVENT_KINDS: ReadonlySet<string> = new Set([
  "channel.in",
  "channel.out",
  "router.in",
  "router.out",
  "agent.error",
]);

type EventKindAssertion = (kind: string) => void;

const fallbackAssertEventKind: EventKindAssertion = (kind) => {
  if (!ALLOWED_EVENT_KINDS.has(kind)) {
    throw new Error(`bootRuntime: disallowed event kind "${kind}"`);
  }
};

async function resolveEventKindAssertion(): Promise<EventKindAssertion> {
  try {
    // Variable-path dynamic import so TS does not statically resolve this.
    const modulePath = "../runtime/event-kinds.js";
    const mod = (await import(modulePath)) as {
      assertEventKind?: EventKindAssertion;
    };
    if (typeof mod.assertEventKind === "function") {
      return mod.assertEventKind;
    }
  } catch {
    // cycle-12 event-kind-lock slice not yet on this branch — use fallback.
  }
  return fallbackAssertEventKind;
}

class InMemoryFallbackStore implements MemoryStore {
  private readonly kv = new Map<string, Map<string, unknown>>();
  private readonly events = new Map<string, MemoryEvent[]>();

  async get(agentId: string, key: string): Promise<unknown> {
    return this.kv.get(agentId)?.get(key);
  }

  async set(agentId: string, key: string, value: unknown): Promise<void> {
    let bucket = this.kv.get(agentId);
    if (!bucket) {
      bucket = new Map();
      this.kv.set(agentId, bucket);
    }
    bucket.set(key, value);
  }

  async list(agentId: string): Promise<string[]> {
    const bucket = this.kv.get(agentId);
    return bucket ? [...bucket.keys()].sort() : [];
  }

  async append(agentId: string, event: MemoryEvent): Promise<void> {
    let arr = this.events.get(agentId);
    if (!arr) {
      arr = [];
      this.events.set(agentId, arr);
    }
    arr.push(event);
  }

  async query(
    agentId: string,
    opts: MemoryQueryOpts = {},
  ): Promise<MemoryEvent[]> {
    const arr = this.events.get(agentId) ?? [];
    const since = opts.sinceTs ?? 0;
    const limit = opts.limit ?? 100;
    return arr
      .filter((e) => e.ts >= since)
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  }

  async close(): Promise<void> {
    this.kv.clear();
    this.events.clear();
  }
}

async function resolveMemoryStore(memoryPath?: string): Promise<MemoryStore> {
  if (memoryPath) {
    return createMemoryStore({ path: memoryPath });
  }
  try {
    const fixturePath = "../agents/__fixtures__/noop-memory.js";
    const mod = (await import(fixturePath)) as {
      createNoopMemoryStore?: () => MemoryStore;
    };
    if (typeof mod.createNoopMemoryStore === "function") {
      return mod.createNoopMemoryStore();
    }
  } catch {
    // fixture not on this branch — fall through
  }
  return new InMemoryFallbackStore();
}

export async function bootRuntime(
  opts: RuntimeOptions = {},
): Promise<Runtime> {
  const now = opts.now ?? ((): number => Date.now());
  const logger = createLogger();
  const metrics = createMetrics();
  const assertEventKind = await resolveEventKindAssertion();

  const memory = await resolveMemoryStore(opts.memoryPath);

  const baseRouter = new ModelRouter({ policy: "local-first" });
  for (const provider of opts.providers ?? []) {
    baseRouter.register(provider);
  }
  const router: Router = instrumentRouter({
    inner: withMemoryLog({
      inner: baseRouter,
      memory,
      agentId: "router",
      now,
    }),
    metrics,
    logger,
    now,
  });

  const scheduler = new Scheduler({ now });
  const bus = new MessageBus();
  const abortController = new AbortController();
  const baseCtx = createAgentContext({
    bus,
    now,
    abort: abortController.signal,
    memory,
  });
  const ctx = withRouter(baseCtx, router);
  const agent = new RouterAgent("router", ctx);
  const schedulable: SchedulableAgent = {
    id: agent.id,
    get state() {
      return agent.state;
    },
    set state(_next) {
      // scheduler never writes state back; ignore.
    },
    start: () => agent.start(),
    stop: async () => {
      if (agent.state === "running" || agent.state === "suspended") {
        agent.stop();
      }
    },
  };
  scheduler.register(schedulable);
  const runPromise = agent.start();

  const channel = new CliStdioChannel({
    agentId: "router",
    bus,
    stdin: opts.stdin as Readable | undefined,
    stdout: opts.stdout as Writable | undefined,
    now,
  });
  await channel.start();

  const intentRouter = createIntentRouter();
  intentRouter.register({
    agentId: "router",
    matches: () => true,
    priority: 1,
  });

  let evCounter = 0;
  const nextEventId = (): string =>
    `runtime-${now()}-${(evCounter++).toString(36)}`;

  const safeAppend = async (
    kind: string,
    payload: unknown,
  ): Promise<void> => {
    try {
      assertEventKind(kind);
      await memory.append("router", {
        id: nextEventId(),
        ts: now(),
        kind,
        payload,
      });
    } catch (err) {
      logger.error("runtime.memory.append", {
        kind,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const unsubIn = bus.subscribe("router", (msg: AgentMessage) => {
    if (msg.kind !== "prompt") return;
    const target = intentRouter.dispatch(msg);
    void safeAppend("channel.in", {
      id: msg.id,
      from: msg.from,
      to: msg.to,
      target,
      payload: msg.payload,
    });
  });

  const unsubOut = bus.subscribe("cli", (msg: AgentMessage) => {
    if (msg.kind !== "completion" && msg.kind !== "error") return;
    void safeAppend("channel.out", {
      id: msg.id,
      from: msg.from,
      to: msg.to,
      messageKind: msg.kind,
      payload: msg.payload,
    });
  });

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = (): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      unsubIn();
      unsubOut();
      await channel.stop();
      if (agent.state === "running" || agent.state === "suspended") {
        try {
          agent.stop();
        } catch {
          // state drifted — ignore
        }
      }
      abortController.abort();
      await runPromise.catch(() => undefined);
      await scheduler.stop();
      await memory.close();
    })();
    return shutdownPromise;
  };

  return {
    shutdown,
    memory,
    router,
    scheduler,
  };
}
