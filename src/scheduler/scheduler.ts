import { TaskQueue } from "./task-queue.js";
import type {
  SchedulableAgent,
  ScheduledTask,
  SchedulerOptions,
} from "./types.js";

export class Scheduler {
  private readonly agents: Map<string, SchedulableAgent> = new Map();
  private readonly queue = new TaskQueue();
  private readonly inFlight: Set<Promise<void>> = new Set();
  private readonly maxConcurrent: number;
  private readonly now: () => number;
  private stopped = false;

  constructor(opts: SchedulerOptions = {}) {
    this.maxConcurrent = opts.maxConcurrent ?? 4;
    this.now = opts.now ?? Date.now;
  }

  register(agent: SchedulableAgent): void {
    this.agents.set(agent.id, agent);
  }

  enqueue(task: ScheduledTask): void {
    if (this.stopped) {
      throw new Error("Scheduler: cannot enqueue after stop()");
    }
    this.queue.enqueue(task);
  }

  pending(): number {
    return this.queue.size();
  }

  activeCount(): number {
    return this.inFlight.size;
  }

  async tick(): Promise<void> {
    if (this.stopped) return;
    const due = this.queue.dequeueDue(this.now());
    const deferred: ScheduledTask[] = [];

    for (const task of due) {
      if (this.inFlight.size >= this.maxConcurrent) {
        deferred.push(task);
        continue;
      }
      const agent = this.agents.get(task.agentId);
      if (!agent) {
        throw new Error(
          `Scheduler: unknown agentId "${task.agentId}" for task "${task.id}"`,
        );
      }
      const run = this.dispatch(agent, task);
      this.inFlight.add(run);
      run.finally(() => {
        this.inFlight.delete(run);
      });
    }

    for (const task of deferred) {
      this.queue.enqueue(task);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }

  private async dispatch(
    agent: SchedulableAgent,
    _task: ScheduledTask,
  ): Promise<void> {
    if (agent.state !== "running") {
      await agent.start();
    }
  }
}
