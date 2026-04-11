import {
  MessageBus,
  createAgentContext,
  type AgentContext,
} from "../agents/index.js";
import { createNoopMemory } from "../agents/__fixtures__/noop-memory.js";
import {
  Scheduler,
  type SchedulableAgent,
  type ScheduledTask,
} from "../scheduler/index.js";

export interface DemoHelloAgent extends SchedulableAgent {
  greet(name: string): string | Promise<string>;
}

export interface DemoHelloAgentCtor {
  new (id: string, ctx: AgentContext): DemoHelloAgent;
}

export interface RunDemoOptions {
  helloAgentCtor?: DemoHelloAgentCtor;
  logger?: (line: string) => void;
  now?: () => number;
}

export type DemoResult =
  | { status: "ok"; greeting: string }
  | { status: "skipped"; reason: string };

const HELLO_AGENT_ID = "hello-agent";
const DEMO_TASK_ID = "demo-greet-1";

export async function runDemo(opts: RunDemoOptions = {}): Promise<DemoResult> {
  const log = opts.logger ?? ((line: string) => console.log(line));
  const bus = new MessageBus();
  const ctx = createAgentContext({ bus, now: opts.now, memory: createNoopMemory() });
  const scheduler = new Scheduler({ now: opts.now });

  const Ctor = opts.helloAgentCtor ?? (await loadHelloAgent());
  if (!Ctor) {
    log("[demo] HelloAgent not available on this branch");
    return { status: "skipped", reason: "HelloAgent module not present" };
  }

  const agent = new Ctor(HELLO_AGENT_ID, ctx);
  scheduler.register(agent);

  const payload = { kind: "greet", name: "world" } as const;
  const task: ScheduledTask = {
    id: DEMO_TASK_ID,
    agentId: agent.id,
    runAt: ctx.now(),
    payload,
  };
  scheduler.enqueue(task);
  await scheduler.tick();

  const greeting = await Promise.resolve(agent.greet("world"));
  log(`[demo] ${greeting}`);
  return { status: "ok", greeting };
}

async function loadHelloAgent(): Promise<DemoHelloAgentCtor | undefined> {
  // Built as a runtime string so the TypeScript checker does not require the
  // module to exist on this slice — engineer-auth's `codex/agent-helloagent`
  // branch ships it, this branch must build standalone.
  const specifier = "../agents/hello-agent.js";
  try {
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      HelloAgent?: DemoHelloAgentCtor;
    };
    return mod.HelloAgent;
  } catch {
    return undefined;
  }
}

const invokedAsScript =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedAsScript) {
  runDemo().catch((err: unknown) => {
    console.error("[demo] failed:", err);
    process.exit(1);
  });
}
