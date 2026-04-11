---
name: event-kind-vocabulary
description: Locked runtime event-kind vocabulary — the 5 kinds the Phase 3 runtime seam is allowed to emit
type: project
---

# Runtime Event-Kind Vocabulary (LOCKED)

**Slice:** `event-kind-lock` · **Owner:** architect ·
**Parents:** `phase3-acceptance.md` §3.8, §7.3, `phase3-integration-plan.md`,
`observability-design.md`.

## 1. Why this is locked

Phase 3 acceptance (`phase3-acceptance.md` §3.8 and §7.3) requires that
after the runtime seam closes, the `events` table in `memory.sqlite`
contains **only** rows whose `kind` column is one of the 5 values below.
The smoke test in §4 greps for `channel.in` and `router.out`; the
operator sign-off in §7.3 greps for rows *outside* this set and fails
the gate if any exist.

Retention indexes (`withRetention`) and observability counters
(`createMetrics`) are both partitioned by `kind`. Adding a 6th kind
after the seam ships forces a retention-index rework and a metrics
label migration — so the vocabulary is frozen here, before the seam
closes, and `src/runtime/event-kinds.ts` is the single source of truth.

Any code that wants to emit a new kind must first land a design update
to this document and a new `event-kind-*` slice — it cannot be added
ad-hoc inside an implementation PR.

## 2. The 5 kinds

Order matches `EVENT_KINDS` in `src/runtime/event-kinds.ts`. Producer
is the *only* module authorized to write that kind; everything else
reads.

| # | Kind          | Producer                              | Emitted when                                                              | Payload shape (conceptual)                                      |
|---|---------------|----------------------------------------|---------------------------------------------------------------------------|-----------------------------------------------------------------|
| 1 | `channel.in`  | Channel adapters (`src/channels/**`)   | A prompt frame arrives on a channel and is accepted for routing.          | `{ traceId, channel, text, receivedAt }`                        |
| 2 | `channel.out` | Channel adapters (`src/channels/**`)   | A reply frame is successfully written back to the channel sink.           | `{ traceId, channel, text, sentAt, latencyMs }`                 |
| 3 | `router.in`   | `instrumentRouter` (`src/obs/**`)      | The router receives a routable request from the intent dispatcher.       | `{ traceId, intent, agent, model, requestedAt }`                |
| 4 | `router.out`  | `withMemoryLog` router wrapper         | The router returns a provider response (success path only).              | `{ traceId, intent, agent, model, tokensIn, tokensOut, ms }`    |
| 5 | `agent.error` | Agent error boundary in runtime seam   | Any agent throws during `handle()` or a provider call fails after retries.| `{ traceId, agent, code, message, cause, at }`                  |

Notes:

- **No `router.error`.** Router failures bubble as `agent.error` because
  Phase 3 has exactly one agent error boundary (the runtime seam) and
  the smoke test only needs a single failure signal.
- **No `memory.write`.** The memory store is the sink for these events,
  not a producer of them. Writing `memory.write` into `memory.sqlite`
  would create a recursive retention-index hotspot.
- **No `scheduler.tick`, `intent.matched`, `provider.call`.** These are
  logger/metrics concerns, not persisted events. They live in
  `createLogger`/`createMetrics` output, never in the events table.
- **Success-only on `router.out`.** Failed routes do not emit
  `router.out`; they emit `agent.error`. This keeps the smoke-test grep
  in §4 honest — a `router.out` row means a real reply reached the
  channel.

## 3. Enforcement

1. **Type level:** `EventKind = typeof EVENT_KINDS[number]`. Anything
   typed as `EventKind` is compiler-checked.
2. **Runtime level:** `isEventKind` and `assertEventKind` gate the
   boundary where untyped strings (e.g. SQL query results, channel
   payloads) re-enter typed code.
3. **Freeze:** `EVENT_KINDS` is `Object.freeze`d so a buggy caller
   cannot mutate the tuple at runtime and silently enlarge the
   vocabulary.
4. **Grep gate:** The Phase 3 operator sign-off (`phase3-acceptance.md`
   §7.3) runs `select distinct kind from events` against the smoke-run
   database and fails if any kind is outside this file.

## 4. Change control

Adding, removing, or renaming a kind is a **breaking runtime change**:

1. Open an architect slice that updates this document first.
2. Update `EVENT_KINDS` in `src/runtime/event-kinds.ts` in the same PR.
3. Update retention indexes and metrics labels in the same PR.
4. Run the §4 smoke test against a fresh `memory.sqlite`; confirm the
   new kind appears and no stale kinds leak.

Do not add kinds inside an unrelated implementation slice.

## 5. Non-goals

- Logger severity levels (`info`, `warn`, `error`) are not event kinds.
- Metric names (`router_requests_total`, etc.) are not event kinds.
- Satellite-mode federation events are out of scope for Phase 3 and
  will be specified in a separate vocabulary doc if/when satellite
  federation lands.
