import { describe, it, expect } from "vitest";
import { createMetrics } from "../../src/obs/metrics.js";

describe("metrics counters", () => {
  it("increments monotonically for same name+labels", () => {
    const m = createMetrics();
    m.inc("requests_total", { route: "/a" });
    m.inc("requests_total", { route: "/a" });
    const snap = m.snapshot();
    expect(snap.counters).toHaveLength(1);
    expect(snap.counters[0]!.value).toBe(2);
    expect(snap.counters[0]!.name).toBe("requests_total");
    expect(snap.counters[0]!.labels).toEqual({ route: "/a" });
  });

  it("separates counters with same name but different labels", () => {
    const m = createMetrics();
    m.inc("requests_total", { route: "/a" });
    m.inc("requests_total", { route: "/b" });
    m.inc("requests_total", { route: "/b" }, 3);
    const snap = m.snapshot();
    expect(snap.counters).toHaveLength(2);
    const byRoute = new Map(
      snap.counters.map((c) => [c.labels.route, c.value]),
    );
    expect(byRoute.get("/a")).toBe(1);
    expect(byRoute.get("/b")).toBe(4);
  });

  it("keys labels order-insensitively", () => {
    const m = createMetrics();
    m.inc("events", { a: "1", b: "2" });
    m.inc("events", { b: "2", a: "1" });
    const snap = m.snapshot();
    expect(snap.counters).toHaveLength(1);
    expect(snap.counters[0]!.value).toBe(2);
  });

  it("supports empty labels", () => {
    const m = createMetrics();
    m.inc("total");
    m.inc("total");
    m.inc("total", {}, 5);
    const snap = m.snapshot();
    expect(snap.counters).toHaveLength(1);
    expect(snap.counters[0]!.value).toBe(7);
  });
});

describe("metrics histograms", () => {
  it("records count, sum, and percentiles for 100 values", () => {
    const m = createMetrics();
    for (let i = 1; i <= 100; i += 1) {
      m.observe("latency_ms", i);
    }
    const snap = m.snapshot();
    expect(snap.histograms).toHaveLength(1);
    const h = snap.histograms[0]!;
    expect(h.count).toBe(100);
    expect(h.sum).toBe(5050);
    expect(h.p50).toBeGreaterThanOrEqual(49);
    expect(h.p50).toBeLessThanOrEqual(51);
    expect(h.p95).toBeGreaterThanOrEqual(94);
    expect(h.p95).toBeLessThanOrEqual(96);
    expect(h.p99).toBeGreaterThanOrEqual(98);
    expect(h.p99).toBeLessThanOrEqual(100);
  });

  it("keys histogram labels order-insensitively", () => {
    const m = createMetrics();
    m.observe("latency_ms", 10, { a: "1", b: "2" });
    m.observe("latency_ms", 20, { b: "2", a: "1" });
    const snap = m.snapshot();
    expect(snap.histograms).toHaveLength(1);
    expect(snap.histograms[0]!.count).toBe(2);
    expect(snap.histograms[0]!.sum).toBe(30);
  });

  it("bounds histogram ring to 1024 samples but preserves count/sum", () => {
    const m = createMetrics();
    let trueSum = 0;
    for (let i = 0; i < 2000; i += 1) {
      m.observe("latency_ms", i);
      trueSum += i;
    }
    const snap = m.snapshot();
    const h = snap.histograms[0]!;
    expect(h.count).toBe(2000);
    expect(h.sum).toBe(trueSum);
    expect(h.p50).toBeGreaterThan(0);
    expect(h.p95).toBeGreaterThan(h.p50);
    expect(h.p99).toBeGreaterThanOrEqual(h.p95);
    expect(h.p99).toBeLessThan(2000);
  });

  it("separates histograms with same name but different labels", () => {
    const m = createMetrics();
    m.observe("latency_ms", 10, { route: "/a" });
    m.observe("latency_ms", 20, { route: "/b" });
    const snap = m.snapshot();
    expect(snap.histograms).toHaveLength(2);
  });
});
