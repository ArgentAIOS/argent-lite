---
name: phase4-roadmap
description: Phase 4 rough roadmap — deferred Phase 3 items, satellite wiring, multi-agent fan-out, Hailo, retention telemetry, file-watch channel
type: project
---

# Phase 4 — Rough Roadmap

**Owner:** architect · **Parent:** `ops/projects/phase3-complete.md` ·
**Status:** planning. Proposals, not slice claims. §7 order is the
load-bearing part.

## 1. Deferred from phase3-complete.md §5 — priority

1. **Retention telemetry** — smallest, unblocks ops visibility.
2. **Satellite runtime wiring** — highest operator value; reuses
   `HttpChannel` + PR #31 auth.
3. **Channel file-watch** — shakeout for the channel contract.
4. **Real Hailo integration** — gated on hardware 2026-04-12.
5. **Multi-agent fan-out** — depends on 2 + 4 stable.
6. **LLM intent strategies** — last; depends on Hailo.
HTTP auth rotation defers until satellite is in real use.

## 2. Satellite runtime wiring

Pi runs `bootRuntime({ mode: "satellite" })`, joins a Mac primary
over HTTP with PR #31 bearer+HMAC, routes `chat.prompt` through the
primary while still writing `channel.in`/`router.out` locally.
`bootSatelliteRuntime()` swaps `RouterAgent` for a
`RemoteRouterClient` against the primary's `/v1/prompt`. Config:
`ARGENT_MODE=satellite`, `ARGENT_PRIMARY_URL`, `ARGENT_PRIMARY_SECRET`.
Primary: `bootRuntime({ mode: "primary" })` mounts `HttpChannel` +
`requireAuth`. Event vocabulary stays locked at 5 values — remote
round-trip reuses `channel.in`/`router.out`; no `channel.remote.*`.
Unreachable primary → `agent.error`; no silent fallback unless
`ARGENT_SATELLITE_FALLBACK=local`. Out of scope: streaming, multi-
primary failover, non-HTTP transports.

## 3. Multi-agent fan-out

Scheduler runs N concurrent `SchedulableAgent`s bound to distinct
intents; `RouterAgent` remains fallback. `createIntentRouter` grows
to an `intent → agentId` map. Scheduler (PR #10) adds `concurrency`
cap + per-agent inbox on `MessageBus` so agents don't race on the
same prompt. `agent-topology-lite.md` updated with supervisor/worker
split before implementation claims. First fan-out slice caps
concurrency at ≤3 for Pi thermals. Depends on §2 stable and §5
shipped.

## 4. Real Hailo integration

Replace the `HailoProvider` stub (PRs #5, #19) once the HAT+ 2 lands
2026-04-12. Keep the PR #4 provider interface; new slice replaces
only the stub body. PR #19 probe graduates from "present?" to
"healthy + model loaded?". Pin vendor runtime version in
`providers/hailo/README.md` — vendor churn is the likeliest
regression source. Reuse `scripts/phase3-smoke.sh` with
`ARGENT_PROVIDER=hailo`. Blocked on hardware.

## 5. Retention telemetry

Surface `withRetention` (PR #23) via existing `obs-metrics`. No new
observability surface; no new event kinds. Counters
`memory.retention.pruned_total`, `memory.retention.ttl_hits_total`
emitted on prune passes (not per write). Histogram
`memory.retention.prune_duration_ms` via PR #26 ring helper.
`bootRuntime()` already wires metrics — zero new call sites.
Smallest slice; depends on nothing.

## 6. Channel file-watch

Second concrete channel after stdio + http: watch a directory for
`*.prompt` files, emit each as `channel.in`, write reply as
`*.reply`. `src/channels/file-watch.ts` on `node:fs.watch` (no
chokidar), debounced against partial-write races. Config
`ARGENT_FILEWATCH_INBOX`/`_OUTBOX`. Same `Channel` contract; no
`bootRuntime()` changes beyond channel selection. If it needs a new
hook, revisit `channels-lite-design.md` before more channels land.

## 7. Slice order

```
retention-telemetry ─┐
                     ├─► satellite-runtime-wiring ─► multi-agent-fanout ─► llm-intent-strategies
channel-file-watch ──┘                                 ▲
hailo-runtime-impl (HW-gated 2026-04-12) ──────────────┘
```

Claim order: `retention-telemetry` → `channel-file-watch` →
`satellite-runtime-wiring` → `hailo-runtime-impl` →
`multi-agent-fanout` → `llm-intent-strategies`. 1 + 2 parallel;
4 blocks only on hardware; 5 must not start until 3 and 4 have
merged and smoked.

## 8. Risks and open questions

**Risks.** Event-kind drift — any new kind updates event-kind-lock +
retention + smoke assertion in one slice; satellite is the likeliest
offender. Pi thermals — fan-out + Hailo + HTTP on one Pi is
untested; first fan-out slice caps concurrency and adds a thermal
metric before lifting the cap. Mac-station mismatch (CLAUDE.md) —
satellite runbooks must not assume a two-station patrol model on
the Pi. Hailo vendor churn — pin the vendor stack version or
regressions become untraceable.

**Open questions.** Does the Mac primary run
`bootRuntime({ mode: "primary" })` out of this repo, or a separate
binary (affects §2 packaging)? Retention telemetry metrics-only or
also `obs-logger` lines (leaning metrics-only)? Fan-out first cap 2
or 3 until we have a thermal read? Does file-watch need intent-
router awareness, or just emit `chat.prompt` like stdio?

## 9. Non-goals

No vocabulary change; no new observability surface; no memory-store
replacement; no multi-primary federation; no streaming in the
satellite slice; no auto-scaling of fan-out.
