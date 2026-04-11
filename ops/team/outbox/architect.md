I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary

Phase 3 observability is local-only: structured JSON logs to stderr
(optional `${ARGENT_HOME}/argent.log.jsonl` sink via `ARGENT_LOG_FILE=1`),
in-process metrics registry (counters + fixed-bucket histograms +
gauges) exposed through the existing router health surface, and an
optional `traceId` propagated channel → bus → agent → router → provider.
No OTLP, no Prometheus client, no network exporters in this phase — a
later `obs-exporter` slice can wrap the interfaces without touching call
sites. Full memo at `ops/projects/observability-design.md` (149 lines,
under the 150-line cap).

## Rationale

- Inbox task 009 locked the scope: stderr/JSONL transport, no OTLP,
  trace_id stamped at channel entry, candidate files under `src/obs/**`
  — the memo honors each bullet (`ops/team/inbox/architect.md` §1–7).
- The event vocabulary (`channel.in/out`, `router.route.ok/err`, …)
  matches the kinds already planned by `phase3-integration-plan.md` §6
  Q3, so retention/telemetry slices can index on a single taxonomy.
- Interfaces (`Logger`/`Metrics`/`Tracer`) are small, injectable, and
  match the existing `AgentContext` DI pattern in
  `src/agents/agent-context.ts`, minimizing churn when call sites adopt.
- Splitting `src/obs/**` landing from call-site instrumentation follows
  the "structure first, wiring second" pattern used successfully in
  `phase3-integration-plan.md` §3 (runtime seam before feature wiring).
- Architect contract bounds honored: no application code written, only
  the authorized design memo + this outbox
  (`ops/contracts/architect.contract.md`).

## Risks and non-goals

- **Non-goals:** OTLP/Prometheus/Loki exporters, log rotation,
  retention, cross-process tracing, HTTP metrics listener.
- **Risks:** (a) interface churn after adoption — mitigated by landing
  `src/obs/**` + tests alone, wiring in `obs-instrumentation`; (b)
  secret leakage via log `fields` — mitigated by sensitive-key denylist
  (`apiKey`, `authorization`, `credentials`, `prompt`, `text`) and
  keeping bodies in `MemoryStore`, not logs.

## Recommended follow-on slices (names only, no claims)

- `obs-core` — implement `src/obs/**` per this memo (engineer surface).
- `obs-instrumentation` — wire `Logger`/`Metrics`/`Tracer` into bus,
  router, agents, channels, memory.
- `obs-health-metrics` — expose `MetricsSnapshot` via router health.
- `obs-exporter` — optional OTLP/Prometheus behind an env flag.
- `obs-rotation` — JSONL rotation + retention policy.

## Files touched

- `ops/projects/observability-design.md` (new, 149 lines)
- `ops/team/outbox/architect.md` (this file)

## Validation

- `wc -l ops/projects/observability-design.md` → 149 (≤150 cap per
  inbox task).
- No application code written; `pnpm test` / `pnpm check` / `pnpm build`
  not run by the architect role per
  `ops/contracts/architect.contract.md` ("does NOT run builds, tests,
  or deploys"). Integration testing belongs to the implementing
  engineer slice (`obs-core`).

## Blockers

None. Memo ready for engineer pickup on `obs-core` once the team lead
opens that slice.

## Contract reference

`ops/contracts/architect.contract.md` (parent:
`ops/contracts/team-onboarding.contract.md`).
