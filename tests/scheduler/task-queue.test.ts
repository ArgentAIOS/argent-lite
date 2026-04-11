import { describe, it, expect } from "vitest";
import { TaskQueue } from "../../src/scheduler/task-queue.js";
import type { ScheduledTask } from "../../src/scheduler/types.js";

function task(id: string, runAt: number): ScheduledTask {
  return { id, agentId: "a", runAt, payload: null };
}

describe("TaskQueue", () => {
  it("reports empty state", () => {
    const q = new TaskQueue();
    expect(q.size()).toBe(0);
    expect(q.peek()).toBeUndefined();
    expect(q.dequeueDue(100)).toEqual([]);
  });

  it("enqueues out-of-order and dequeues in runAt order", () => {
    const q = new TaskQueue();
    q.enqueue(task("c", 30));
    q.enqueue(task("a", 10));
    q.enqueue(task("b", 20));
    expect(q.size()).toBe(3);
    expect(q.peek()?.id).toBe("a");

    const due = q.dequeueDue(25);
    expect(due.map((t) => t.id)).toEqual(["a", "b"]);
    expect(q.size()).toBe(1);
    expect(q.peek()?.id).toBe("c");
  });

  it("preserves FIFO ordering for ties in runAt", () => {
    const q = new TaskQueue();
    q.enqueue(task("first", 10));
    q.enqueue(task("second", 10));
    q.enqueue(task("third", 10));

    const due = q.dequeueDue(10);
    expect(due.map((t) => t.id)).toEqual(["first", "second", "third"]);
  });

  it("dequeueDue only returns tasks at or before now", () => {
    const q = new TaskQueue();
    q.enqueue(task("a", 10));
    q.enqueue(task("b", 50));
    expect(q.dequeueDue(9)).toEqual([]);
    expect(q.dequeueDue(10).map((t) => t.id)).toEqual(["a"]);
    expect(q.size()).toBe(1);
  });
});
