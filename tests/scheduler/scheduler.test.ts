import { describe, it, expect } from "vitest";
import { Scheduler } from "../../src/scheduler/scheduler.js";
import type {
  AgentState,
  SchedulableAgent,
  ScheduledTask,
} from "../../src/scheduler/types.js";

interface MockAgent extends SchedulableAgent {
  startCalls: number;
  stopCalls: number;
  release: () => void;
  started: Promise<void>;
}

function mockAgent(id: string, opts: { holdStart?: boolean } = {}): MockAgent {
  let state: AgentState = "ready";
  let releaseFn = () => {};
  let startedResolve: () => void = () => {};
  const started = new Promise<void>((r) => {
    startedResolve = r;
  });
  const agent: MockAgent = {
    id,
    get state() {
      return state;
    },
    set state(s: AgentState) {
      state = s;
    },
    startCalls: 0,
    stopCalls: 0,
    release: () => releaseFn(),
    started,
    async start() {
      this.startCalls++;
      state = "running";
      startedResolve();
      if (opts.holdStart) {
        await new Promise<void>((resolve) => {
          releaseFn = resolve;
        });
      }
    },
    async stop() {
      this.stopCalls++;
      state = "stopped";
    },
  };
  return agent;
}

function task(id: string, agentId: string, runAt: number): ScheduledTask {
  return { id, agentId, runAt, payload: null };
}

describe("Scheduler", () => {
  it("dispatches due tasks to the target agent on tick()", async () => {
    const clock = { t: 0 };
    const s = new Scheduler({ now: () => clock.t });
    const a = mockAgent("alpha");
    const b = mockAgent("beta");
    s.register(a);
    s.register(b);

    s.enqueue(task("t1", "alpha", 10));
    s.enqueue(task("t2", "beta", 20));
    s.enqueue(task("t3", "alpha", 30));

    clock.t = 25;
    await s.tick();
    await s.stop();

    expect(a.startCalls).toBe(1);
    expect(b.startCalls).toBe(1);
    expect(s.pending()).toBe(1);
  });

  it("respects maxConcurrent and requeues excess", async () => {
    const clock = { t: 100 };
    const s = new Scheduler({ now: () => clock.t, maxConcurrent: 1 });
    const a = mockAgent("a", { holdStart: true });
    const b = mockAgent("b", { holdStart: true });
    s.register(a);
    s.register(b);

    s.enqueue(task("t1", "a", 10));
    s.enqueue(task("t2", "b", 20));

    await s.tick();
    expect(s.activeCount()).toBe(1);
    expect(s.pending()).toBe(1);
    expect(a.startCalls).toBe(1);
    expect(b.startCalls).toBe(0);

    a.release();
    await a.started;
    await Promise.resolve();
    await Promise.resolve();

    await s.tick();
    expect(b.startCalls).toBe(1);
    b.release();
    await s.stop();
  });

  it("stop() awaits in-flight tasks", async () => {
    const clock = { t: 50 };
    const s = new Scheduler({ now: () => clock.t });
    const a = mockAgent("a", { holdStart: true });
    s.register(a);
    s.enqueue(task("t1", "a", 10));

    await s.tick();
    expect(s.activeCount()).toBe(1);

    let stopped = false;
    const stopPromise = s.stop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);

    a.release();
    await stopPromise;
    expect(stopped).toBe(true);
    expect(s.activeCount()).toBe(0);
  });

  it("throws on unknown agentId", async () => {
    const s = new Scheduler({ now: () => 100 });
    s.enqueue(task("t1", "ghost", 10));
    await expect(s.tick()).rejects.toThrow(/unknown agentId/);
  });

  it("does not re-start an already running agent", async () => {
    const clock = { t: 100 };
    const s = new Scheduler({ now: () => clock.t });
    const a = mockAgent("a");
    a.state = "running";
    s.register(a);
    s.enqueue(task("t1", "a", 10));

    await s.tick();
    await s.stop();
    expect(a.startCalls).toBe(0);
  });

  it("refuses enqueue after stop()", async () => {
    const s = new Scheduler();
    await s.stop();
    expect(() => s.enqueue(task("t1", "a", 10))).toThrow(/after stop/);
  });

});
