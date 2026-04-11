# Intent Routing Design — Phase 3 Gate Planning Doc

**Status:** planning · **Slice:** `intent-routing-design` ·
**Branch:** `codex/intent-routing-design` · **Owner:** architect ·
**Parents:** `channels-lite-design.md`, `agent-topology-lite.md` ·
**Consumers:** `intent-core`, `intent-static-router`, `intent-keyword-router`, `intent-llm-router`, `intent-dispatcher-agent`.

## 1. Decision summary

An **intent** is a typed classification of an inbound `ChannelMessage`
that names *what the user wants* before any agent runs. The
`IntentRouter` sits between `channel:*:in` and agent delivery: it
reads one `ChannelMessage`, resolves it to a single `{kind, payload}`
intent, and dispatches to exactly one registered `agentId`. Phase 3
ships three composable strategies — **static**, **keyword**, **LLM** —
behind one interface, with a mandatory fallback agent and deterministic
conflict rules.

## 2. Scope and non-goals

**In scope:** intent shape, `IntentRouter` interface, three strategies,
registry, fallback, channel integration, slice breakdown.
**Non-goals:** multi-agent fan-out, workflow chaining, memory-learned
routing, cross-tenant namespaces, streaming classification.

## 3. Intent model

```ts
interface Intent<T = unknown> {
  kind: string;        // "chat.prompt", "file.summarize", "system.health"
  payload: T;          // handler-owned shape
  confidence: number;  // 0..1; static=1, keyword=match-ratio, llm=score
  source: "static" | "keyword" | "llm" | "fallback";
}
```

`kind` is a dotted namespace registered once at boot. Payload schemas
are owned by the handler agent — the router only guarantees `kind`
is known. `confidence` lets the dispatcher fall through to the next
strategy when a classifier is unsure (§6).

## 4. `IntentRouter` interface

```ts
interface IntentHandler { agentId: string; kind: string; priority?: number; }
interface IntentStrategy {
  readonly name: "static" | "keyword" | "llm";
  classify(msg: ChannelMessage): Promise<Intent | null>;
}
interface IntentRouter {
  register(h: IntentHandler): void;
  addStrategy(s: IntentStrategy): void;
  dispatch(msg: ChannelMessage): Promise<{ agentId: string; intent: Intent }>;
}
```

`dispatch` runs strategies in registration order, short-circuits on
the first result whose `confidence ≥ threshold` (default 0.6), and
falls through otherwise. If all strategies decline, it returns the
`kind:"*"` fallback handler with a synthetic fallback intent.

## 5. Routing strategies

| Strategy | Input | Decision rule | Confidence |
| --- | --- | --- | --- |
| `static`  | `msg.channelId` | exact channel-id → kind map | `1.0` |
| `keyword` | `msg.body` string | regex/token table per kind | `matches/total` |
| `llm`     | `msg.body` | `ModelRouter.route()` with classifier prompt | parsed from JSON |

Static is cheapest and deterministic. Keyword handles channels that
host mixed intents. LLM is opt-in behind `ARGENT_INTENT_LLM=1`
because it costs one model call per message. Strategies register in
cheapest-first order; per-channel allow-lists can disable any of them.

## 6. Fallback and conflict resolution

1. Each strategy returns ≤1 `Intent` per message.
2. `dispatch` picks the first strategy above threshold.
3. Two handlers on the same `kind` → higher `priority` wins; ties
   are a boot-time `IntentConflictError` (fail loud, never silent).
4. A `kind:"*"` fallback handler is mandatory; absence is a boot-time
   `IntentNoFallbackError`.
5. LLM failures (timeout, parse error) degrade to `null`, never throw
   out of `dispatch`. Errors increment the existing metrics hook.

## 7. Channel integration

The router is a **bus subscriber**, not a channel wrapper. Flow:
`bus("channel:*:in")` → `IntentRouter.dispatch` →
`bus("agent:<agentId>:inbox")`, preserving `ChannelMessage.id` for
reply correlation. It runs as `IntentDispatcherAgent` inside the
scheduler so it inherits lifecycle, abort signal, and metrics.
Replies flow back on `channel:<id>:out` unchanged — the router never
touches egress.

## 8. Candidate file areas

```
src/intents/
  index.ts               # re-exports types + DefaultIntentRouter
  types.ts               # Intent, IntentHandler, IntentStrategy, IntentRouter
  errors.ts              # IntentConflictError, IntentNoFallbackError
  default-router.ts      # DefaultIntentRouter
  strategies/{static,keyword,llm}.ts
  dispatcher-agent.ts    # bus → router bridge
test/intents/{default-router,static,keyword,llm,dispatcher}.test.ts
```

No writes outside `src/intents/**` except a one-line demo-runner wire
and a `Scheduler` registration line, handled in their own slices.

## 9. Phased slice breakdown

| Slice | Surface | Depends on |
| --- | --- | --- |
| `intent-core` | `src/intents/{index,types,errors,default-router}.ts` + tests | this doc |
| `intent-static-router` | `src/intents/strategies/static.ts` + tests | `intent-core` |
| `intent-keyword-router` | `src/intents/strategies/keyword.ts` + tests | `intent-core` |
| `intent-llm-router` | `src/intents/strategies/llm.ts` + tests | `intent-core`, existing `ModelRouter` |
| `intent-dispatcher-agent` | `src/intents/dispatcher-agent.ts` + tests | `intent-core`, `channel-core` |

`intent-core` is the gatekeeper; strategy slices run in parallel after
it merges. Dispatcher merges last since it binds channels, router, and
scheduler together.

## 10. Acceptance criteria (engineer-facing)

1. `register` rejects duplicate `{kind,priority}` pairs with
   `IntentConflictError`; boot without `"*"` fallback throws
   `IntentNoFallbackError`.
2. `dispatch` short-circuits on first strategy ≥ threshold — test
   stubs `static=null, keyword=0.9, llm=throws` and asserts keyword
   wins without invoking llm.
3. Static returns `confidence:1` on channel-id match, else `null`.
4. Keyword: given `{"file.summarize":[/^summarize /i]}`, body
   `"Summarize this"` → `kind:"file.summarize"`, `confidence ≥ 0.5`.
5. LLM parses `{kind,confidence}` JSON from `ModelRouter`; parse
   error or timeout → `null` + error-counter increment.
6. `IntentDispatcherAgent` republishes to `agent:<agentId>:inbox`
   with the original `ChannelMessage.id` preserved.
7. No strategy or handler leaks async work past `scheduler.stop()`
   (`process._getActiveHandles().length` unchanged).

## 11. Open questions

1. Confidence threshold 0.6 is a guess — revisit after first LLM run.
2. Per-channel strategy allow-list config shape not decided.
3. Multi-intent messages deferred to Phase 4 workflow chaining.
4. Per-kind telemetry histogram: defer until second consumer asks.
5. Memory-aware routing out of scope until memory slice wires in.
