export interface Metrics {
  inc(name: string, labels?: Record<string, string>, by?: number): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
  snapshot(): MetricsSnapshot;
}

export interface CounterSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface HistogramSample {
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricsSnapshot {
  counters: CounterSample[];
  histograms: HistogramSample[];
}

const HISTOGRAM_CAP = 1024;

interface CounterEntry {
  name: string;
  labels: Record<string, string>;
  value: number;
}

interface HistogramEntry {
  name: string;
  labels: Record<string, string>;
  ring: number[];
  writeIdx: number;
  count: number;
  sum: number;
}

function seriesKey(name: string, labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  let key = name + "\u0000";
  for (const k of keys) {
    key += k + "\u0001" + labels[k] + "\u0002";
  }
  return key;
}

function cloneLabels(labels: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(labels).sort()) {
    out[k] = labels[k]!;
  }
  return out;
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = q * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

class MetricsImpl implements Metrics {
  private readonly counters = new Map<string, CounterEntry>();
  private readonly histograms = new Map<string, HistogramEntry>();

  inc(name: string, labels: Record<string, string> = {}, by = 1): void {
    const key = seriesKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += by;
      return;
    }
    this.counters.set(key, { name, labels: cloneLabels(labels), value: by });
  }

  observe(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    const key = seriesKey(name, labels);
    let entry = this.histograms.get(key);
    if (!entry) {
      entry = {
        name,
        labels: cloneLabels(labels),
        ring: [],
        writeIdx: 0,
        count: 0,
        sum: 0,
      };
      this.histograms.set(key, entry);
    }
    if (entry.ring.length < HISTOGRAM_CAP) {
      entry.ring.push(value);
    } else {
      entry.ring[entry.writeIdx] = value;
      entry.writeIdx = (entry.writeIdx + 1) % HISTOGRAM_CAP;
    }
    entry.count += 1;
    entry.sum += value;
  }

  snapshot(): MetricsSnapshot {
    const counters: CounterSample[] = [];
    for (const c of this.counters.values()) {
      counters.push({ name: c.name, labels: { ...c.labels }, value: c.value });
    }
    const histograms: HistogramSample[] = [];
    for (const h of this.histograms.values()) {
      const sorted = [...h.ring].sort((a, b) => a - b);
      histograms.push({
        name: h.name,
        labels: { ...h.labels },
        count: h.count,
        sum: h.sum,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
      });
    }
    return { counters, histograms };
  }
}

export function createMetrics(): Metrics {
  return new MetricsImpl();
}
