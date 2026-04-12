import type { ScheduledTask } from "./types.js";

export class TaskQueue {
  private readonly tasks: ScheduledTask[] = [];

  enqueue(task: ScheduledTask): void {
    const idx = this.findInsertIndex(task.runAt);
    this.tasks.splice(idx, 0, task);
  }

  dequeueDue(now: number): ScheduledTask[] {
    const due: ScheduledTask[] = [];
    while (this.tasks.length > 0 && this.tasks[0]!.runAt <= now) {
      due.push(this.tasks.shift()!);
    }
    return due;
  }

  peek(): ScheduledTask | undefined {
    return this.tasks[0];
  }

  size(): number {
    return this.tasks.length;
  }

  private findInsertIndex(runAt: number): number {
    let lo = 0;
    let hi = this.tasks.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.tasks[mid]!.runAt <= runAt) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
}
