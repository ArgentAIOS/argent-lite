# Observability Design (Phase 3)

**Slice:** `observability-design` · **Owner:** architect ·
**Parents:** `phase3-integration-plan.md`, `memory-lite-design.md`.

## 1. Decision summary

Phase 3 ships a **local-only** observability seam: structured JSON logs
to stderr (optional JSONL file sink), an in-process metrics registry
(counters + histograms) exposed via the existing router health surface,
and an optional `trace_id` propagated from channel entry through
bus → agent → router → provider. No OTLP, no network exporters, no
third-party SDK. A later `obs-exporter` slice can bolt exporters onto
these interfaces without touching call sites.

## 2. What we log

One JSON record per line, `stderr` by default, tee'd to
`${ARGENT_HOME}/argent.log.jsonl` when `ARGENT_LOG_FILE=1`. Record shape:
`{ ts, level, msg, component, traceId|null, span|null, fields }`.

Required event vocabulary (locked, so dashboards can index):

- `channel.in` / `channel.out` — `{ channel, bytes }`
- `bus.publish` / `bus.deliver` — `{ topic, subscribers }`
- `agent.handle.ok` / `agent.handle.err` — `{ agentId, durationMs }`
- `router.route.ok` / `router.route.err` — `{ providerId, model, durationMs }`
- `provider.call.ok` / `provider.call.err` — `{ providerId, durationMs, httpStatus? }`
- `memory.append` / `memory.query` — `{ kind, rows }`

Logger drops known-sensitive keys (`apiKey`, `authorization`,
`credentials`, `prompt`, `text`) unless caller passes `{ unsafe: true }`.
Prompt/response bodies live in `MemoryStore`, not in logs.

## 3. What we count

In-process registry, read on demand. `MetricsSnapshot` is plain JSON; no
Prometheus client in Phase 3.

- **Counters:** `router_routes_total{providerId,outcome}`,
  `agent_messages_total{agentId,outcome}`, `memory_ops_total{op,kind}`,
  `bus_publish_total{topic}`, `channel_frames_total{channel,direction}`.
- **Histograms** (fixed buckets ms
  `[1,5,10,25,50,100,250,500,1000,2500,5000,10000,+Inf]`):
  `provider_latency_ms{providerId}`, `router_route_latency_ms{providerId}`,
  `agent_handle_latency_ms{agentId}`, `memory_op_latency_ms{op}`.
- **Gauges:** `bus_subscribers{topic}`, `memory_rows{kind}` (on query).

## 4. Trace context

Optional, best-effort, single-process. `Tracer.start(name, parent?)`
returns a `Span` carrying a ULID `traceId`. Channels stamp `traceId` on
the inbound envelope; `MessageBus` copies it onto delivered messages;
`RouterAgent` forwards it to `ModelRouter` via `RouteContext { traceId? }`;
providers log it on every record. Absent `traceId` → `null` everywhere.
Tracing is never load-bearing. No span export in this phase.

## 5. Transport

- **stderr (default)** newline-delimited JSON; **JSONL file (opt-in)**
  via `ARGENT_LOG_FILE=1` (rotation out of scope).
- **Metrics** — `getMetricsSnapshot()` sibling on the existing router
  health surface. No new HTTP listener.
- **No OTLP, gRPC, or exporters.** Deferred to `obs-exporter`.

## 6. Interfaces (`src/obs/types.ts`)

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  ts: string; level: LogLevel; msg: string; component: string;
  traceId: string | null; span: string | null;
  fields: Record<string, unknown>;
}

type F = Record<string, unknown>;
type L = Record<string, string>;

export interface Logger {
  child(b: { component: string; traceId?: string }): Logger;
  debug(msg: string, fields?: F): void;
  info(msg: string, fields?: F): void;
  warn(msg: string, fields?: F): void;
  error(msg: string, fields?: F): void;
}

export interface Metrics {
  incr(name: string, labels?: L, by?: number): void;
  observe(name: string, valueMs: number, labels?: L): void;
  gauge(name: string, value: number, labels?: L): void;
  snapshot(): MetricsSnapshot;
}

export interface MetricsSnapshot {
  counters: Array<{ name: string; labels: L; value: number }>;
  histograms: Array<{ name: string; labels: L; buckets: number[];
    counts: number[]; sum: number; count: number }>;
  gauges: Array<{ name: string; labels: L; value: number }>;
}

export interface Span { traceId: string; name: string; end(fields?: F): void; }
export interface Tracer {
  start(name: string, parent?: { traceId: string } | null): Span;
}
```

## 7. Candidate files (`src/obs/**`)

- `src/obs/types.ts` — interfaces above.
- `src/obs/logger.ts` — `createLogger()` (stderr + optional JSONL file).
- `src/obs/metrics.ts` — fixed-bucket in-process registry.
- `src/obs/tracer.ts` — ULID trace ids, no export.
- `src/obs/index.ts` — barrel + `createObservability()` factory that
  `bootRuntime()` calls once and injects into `AgentContext` as
  `ctx.log`, `ctx.metrics`, `ctx.tracer`.
- `test/obs/{logger,metrics,tracer}.test.ts`.

`AgentContext` gains three non-optional fields. Instrumentation of bus,
router, agents, channels, memory is a **separate** follow-on slice
(`obs-instrumentation`); this slice lands only `src/obs/**` + tests.

## 8. Acceptance criteria (design gate)

1. `src/obs/types.ts` compiles with the signatures above; no other
   module imports it yet.
2. `Logger` emits one JSON line per call, schema-validated in test;
   sensitive keys dropped unless `unsafe: true`.
3. `Metrics.snapshot()` round-trips counters, histograms, and gauges.
4. `Tracer.start()` returns unique `traceId`s; `Span.end()` is idempotent.
5. No OTLP/Prometheus/network dependency added to `package.json`.
6. `pnpm check` and `pnpm test` green; surface is `src/obs/**` + tests.

## 9. Non-goals and risks

- **Non-goals:** OTLP/Prometheus/Loki exporters; log rotation; retention;
  cross-process tracing; HTTP metrics listener.
- **Risks:** (a) interface churn after call sites adopt — mitigated by
  landing `src/obs/**` + tests first, wiring in `obs-instrumentation`;
  (b) secret leakage via `fields` — mitigated by sensitive-key denylist
  and keeping bodies in `MemoryStore`.

## 10. Recommended follow-on slices (names only, no claims)

- `obs-instrumentation` — wire `Logger`/`Metrics`/`Tracer` into bus,
  router, agents, channels, memory.
- `obs-health-metrics` — expose `MetricsSnapshot` via router health.
- `obs-exporter` — optional OTLP/Prometheus behind an env flag.
- `obs-rotation` — JSONL rotation + retention.
