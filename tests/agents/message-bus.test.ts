import { describe, expect, it } from "vitest";
import { MessageBus, type AgentMessage } from "../../src/agents/index.js";

function mkMsg(from: string, to: string, n: number): AgentMessage {
  return {
    id: `m${n}`,
    from,
    to,
    kind: "test",
    payload: { n },
    ts: n,
  };
}

describe("MessageBus", () => {
  it("delivers a message from A to B", () => {
    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    bus.subscribe("B", (msg) => {
      received.push(msg);
    });

    bus.send(mkMsg("A", "B", 1));

    expect(received).toHaveLength(1);
    expect(received[0]?.from).toBe("A");
    expect(received[0]?.to).toBe("B");
  });

  it("preserves in-order delivery per (from, to) pair", () => {
    const bus = new MessageBus();
    const received: number[] = [];
    bus.subscribe("B", (msg) => {
      const { n } = msg.payload as { n: number };
      received.push(n);
    });

    for (let i = 0; i < 10; i++) {
      bus.send(mkMsg("A", "B", i));
    }

    expect(received).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("does not deliver messages addressed to other agents", () => {
    const bus = new MessageBus();
    const toB: AgentMessage[] = [];
    const toC: AgentMessage[] = [];
    bus.subscribe("B", (m) => {
      toB.push(m);
    });
    bus.subscribe("C", (m) => {
      toC.push(m);
    });

    bus.send(mkMsg("A", "B", 1));
    bus.send(mkMsg("A", "C", 2));

    expect(toB).toHaveLength(1);
    expect(toC).toHaveLength(1);
    expect(toB[0]?.id).toBe("m1");
    expect(toC[0]?.id).toBe("m2");
  });

  it("unsubscribe stops delivery", () => {
    const bus = new MessageBus();
    const received: AgentMessage[] = [];
    const unsubscribe = bus.subscribe("B", (msg) => {
      received.push(msg);
    });

    bus.send(mkMsg("A", "B", 1));
    unsubscribe();
    bus.send(mkMsg("A", "B", 2));

    expect(received).toHaveLength(1);
    expect(received[0]?.id).toBe("m1");
  });
});
