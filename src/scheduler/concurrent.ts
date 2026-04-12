import { TaskQueue } from "./task-queue.js";
import type { SchedulableAgent, ScheduledTask } from "./types.js";

export interface ConcurrentSchedulerOptions {
  maxConcurrent?: number;
  now?: () => number;
}

export class ConcurrentScheduler {
  private readonly agents: Map<string, SchedulableAgent> = new Map();
  private readonly queue = new TaskQueue();
  private readonly inFlight: Map<string, Set<Promise<void>>> = new Map();
  private readonly maxConcurrent: number;
  private readonly now: () => number;
  private stopped = false;

  constructor(opts: ConcurrentSchedulerOptions = {}) {
    this.maxConcurrent = opts.maxConcurrent ?? 4;
    this.now = opts.now ?? Date.now;
  }

  register(agent: SchedulableAgent): void {
    this.agents.set(agent.id, agent);
  }

  enqueue(task: ScheduledTask): void {
    if (this.stopped) {
      throw new Error("ConcurrentScheduler: cannot enqueue after stop()");
    }
    this.queue.enqueue(task);
  }

  active(): number {
    let count = 0;
    for (const bucket of this.inFlight.values()) {
      count += bucket.size;
    }
    return count;
  }

  async tick(): Promise<void> {
    if (this.stopped) return;
    const due = this.queue.dequeueDue(this.now());
    const deferred: ScheduledTask[] = [];

    for (const task of due) {
      if (this.active() >= this.maxConcurrent) {
        deferred.push(task);
        continue;
      }
      const agent = this.agents.get(task.agentId);
      if (!agent) {
        throw new Error(
          `ConcurrentScheduler: unknown agentId "${task.agentId}" for task "${task.id}"`,
        );
      }
      const run = this.dispatch(agent, task);
      let bucket = this.inFlight.get(agent.id);
      if (!bucket) {
        bucket = new Set();
        this.inFlight.set(agent.id, bucket);
      }
      bucket.add(run);
      const owner = bucket;
      run.finally(() => {
        owner.delete(run);
        if (owner.size === 0) {
          this.inFlight.delete(agent.id);
        }
      });
    }

    for (const task of deferred) {
      this.queue.enqueue(task);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    while (this.active() > 0) {
      const all: Promise<void>[] = [];
      for (const bucket of this.inFlight.values()) {
        for (const p of bucket) all.push(p);
      }
      await Promise.allSettled(all);
    }
  }

  private async dispatch(
    agent: SchedulableAgent,
    _task: ScheduledTask,
  ): Promise<void> {
    try {
      await agent.start();
    } catch {
      // Isolate agent crashes so one bad task does not stall the scheduler.
    }
  }
}
