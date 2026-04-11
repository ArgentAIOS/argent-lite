I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary

Authored `ops/projects/intent-routing-design.md` (150 lines, §9 shape)
defining how Argent Lite routes inbound `ChannelMessage`s to agents.
An **intent** is a typed `{ kind, payload, confidence, source }`. The
`IntentRouter` composes three strategies (static channel-map, keyword
table, LLM classifier via existing `ModelRouter`), short-circuits on
the first result clearing a 0.6 confidence threshold, and falls back
to a mandatory `kind:"*"` handler. Boot fails loudly on duplicate
handlers or missing fallback. Integration is a bus subscriber
(`IntentDispatcherAgent`) between `channel:*:in` and
`agent:<id>:inbox` — no changes to channel egress. Sub-slices:
`intent-core` (gatekeeper), then parallel `intent-static-router`,
`intent-keyword-router`, `intent-llm-router`, then
`intent-dispatcher-agent` last.

## Rationale

- Mirrors the §9-shape decision-memo style established by
  `ops/projects/channels-lite-design.md` and
  `ops/projects/phase3-integration-plan.md`.
- Channel flow (publish to `channel:<id>:in`) comes directly from
  `channels-lite-design.md §3`; this doc only reads from that bus.
- Strategy layering (cheapest-first, LLM opt-in behind
  `ARGENT_INTENT_LLM`) respects cost discipline — no model call per
  message by default.
- `IntentDispatcherAgent` reuses the scheduler/abort/metrics seams
  already designed in `agent-topology-lite.md`, so lifecycle
  behavior is inherited, not reinvented.
- Surface stays inside `src/intents/**` per
  `ops/contracts/architect.contract.md` (authorized surface for this
  task: `ops/projects/intent-routing-design.md` +
  `ops/team/outbox/architect.md`). No application code written.

## Risks and non-goals

- Confidence threshold 0.6 is a guess; needs tuning once LLM strategy
  runs on real traffic.
- LLM strategy depends on `ModelRouter` JSON-parsing stability; parse
  failures degrade to `null` (counted via existing metrics hook) but
  a noisy model could silently starve the pipeline — watch in obs.
- Multi-intent messages, workflow chaining, and memory-aware routing
  are explicitly out of scope for Phase 3.
- No Mac-station or clean-lane assumptions in this doc; Pi-only
  single-worktree execution is fine.

## Files touched

- `ops/projects/intent-routing-design.md` (created, 150 lines)
- `ops/team/outbox/architect.md` (this file)

## Validation

- `wc -l ops/projects/intent-routing-design.md` → 150 (meets ≤150
  line budget from inbox).
- No `package.json`-level validation run: architect contract forbids
  running builds/tests, and the surface is docs-only.
- Contract reference: `ops/contracts/architect.contract.md`
  (parent: `ops/contracts/team-onboarding.contract.md`).

## Recommended follow-on slices (names only)

- `intent-core`
- `intent-static-router`
- `intent-keyword-router`
- `intent-llm-router`
- `intent-dispatcher-agent`

## Blockers / open questions

None blocking. Open questions documented in §11 of the design doc
(confidence threshold, per-channel allow-list config shape,
multi-intent deferral, per-kind telemetry, memory-aware routing).
