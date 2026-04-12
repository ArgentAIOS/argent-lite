import { describe, it, expect } from "vitest";
import { ConcurrentScheduler } from "../../src/scheduler/concurrent.js";
import type {
  AgentState,
  SchedulableAgent,
  ScheduledTask,
} from "../../src/scheduler/types.js";

interface MockAgent extends SchedulableAgent {
  startCalls: number;
  release(): boolean;
  pendingReleases(): number;
  crashOnNext: boolean;
}

function mockAgent(id: string): MockAgent {
  const waiters: Array<() => void> = [];
  let state: AgentState = "ready";
  const agent: MockAgent = {
    id,
    get state() {
      return state;
    },
    set state(s: AgentState) {
      state = s;
    },
    startCalls: 0,
    crashOnNext: false,
    async start() {
      this.startCalls++;
      state = "running";
      if (this.crashOnNext) {
        this.crashOnNext = false;
        throw new Error(`agent ${id} crashed`);
      }
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
    async stop() {
      state = "stopped";
    },
    release() {
      const r = waiters.shift();
      if (!r) return false;
      r();
      return true;
    },
    pendingReleases() {
      return waiters.length;
    },
  };
  return agent;
}

function task(id: string, agentId: string, runAt: number): ScheduledTask {
  return { id, agentId, runAt, payload: null };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("ConcurrentScheduler", () => {
  it("runs at most maxConcurrent tasks; additional tasks start as slots free", async () => {
    const clock = { t: 100 };
    const s = new ConcurrentScheduler({
      now: () => clock.t,
      maxConcurrent: 2,
    });
    const a = mockAgent("a");
    const b = mockAgent("b");
    const c = mockAgent("c");
    s.register(a);
    s.register(b);
    s.register(c);

    s.enqueue(task("t1", "a", 10));
    s.enqueue(task("t2", "b", 10));
    s.enqueue(task("t3", "c", 10));
    s.enqueue(task("t4", "a", 10));
    s.enqueue(task("t5", "b", 10));

    await s.tick();
    expect(s.active()).toBe(2);
    expect(a.startCalls + b.startCalls + c.startCalls).toBe(2);

    // Release one in-flight slot; next tick should start exactly one more.
    expect(a.release()).toBe(true);
    await flush();
    expect(s.active()).toBe(1);

    await s.tick();
    expect(s.active()).toBe(2);
    expect(a.startCalls + b.startCalls + c.startCalls).toBe(3);

    // Drain the rest: release any holders, re-tick, bounded iterations.
    for (let i = 0; i < 20 && s.active() + a.startCalls + b.startCalls + c.startCalls < 7; i++) {
      a.release();
      b.release();
      c.release();
      await flush();
      await s.tick();
    }
    // Final drain of still-in-flight tasks.
    while (s.active() > 0) {
      a.release();
      b.release();
      c.release();
      await flush();
    }

    expect(a.startCalls).toBe(2);
    expect(b.startCalls).toBe(2);
    expect(c.startCalls).toBe(1);
  });

  it("stop() resolves only after all in-flight tasks complete", async () => {
    const s = new ConcurrentScheduler({ now: () => 50, maxConcurrent: 4 });
    const a = mockAgent("a");
    s.register(a);
    s.enqueue(task("t1", "a", 10));

    await s.tick();
    expect(s.active()).toBe(1);

    let resolved = false;
    const stopPromise = s.stop().then(() => {
      resolved = true;
    });

    await flush();
    expect(resolved).toBe(false);
    expect(s.active()).toBe(1);

    a.release();
    await stopPromise;
    expect(resolved).toBe(true);
    expect(s.active()).toBe(0);
  });

  it("agent crash does not block the scheduler", async () => {
    const clock = { t: 100 };
    const s = new ConcurrentScheduler({
      now: () => clock.t,
      maxConcurrent: 2,
    });
    const crasher = mockAgent("crasher");
    crasher.crashOnNext = true;
    const healthy = mockAgent("healthy");
    s.register(crasher);
    s.register(healthy);

    s.enqueue(task("t1", "crasher", 10));
    s.enqueue(task("t2", "healthy", 10));

    await s.tick();
    // Allow the crasher promise chain to settle (.finally cleanup).
    await flush();

    expect(crasher.startCalls).toBe(1);
    expect(healthy.startCalls).toBe(1);
    // Only the healthy task is still holding a slot.
    expect(s.active()).toBe(1);

    healthy.release();
    await s.stop();
    expect(s.active()).toBe(0);
  });

  it("refuses enqueue after stop()", async () => {
    const s = new ConcurrentScheduler();
    await s.stop();
    expect(() => s.enqueue(task("t1", "a", 10))).toThrow(/after stop/);
  });

  it("throws on unknown agentId during tick()", async () => {
    const s = new ConcurrentScheduler({ now: () => 100 });
    s.enqueue(task("t1", "ghost", 10));
    await expect(s.tick()).rejects.toThrow(/unknown agentId/);
  });
});
