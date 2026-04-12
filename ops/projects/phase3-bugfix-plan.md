---
name: phase3-bugfix-plan
description: Architect plan for the three Phase 3 §4 smoke bugs (event-kind mismatch, bus→agent dispatch race, reply-address convention)
type: project
---
# Phase 3 Bugfix Plan (cycle-13 smoke findings)
**Parents:** `phase3-acceptance.md` §4/§7.3, `event-kind-vocabulary.md`, `phase3-integration-plan.md`.

## 1. Bugs (line-cited)
**A. Event-kind vocabulary mismatch.**
`src/router/memory-router.ts:50` emits `router.route`; `:58` emits `router.error`. `src/runtime/event-kinds.ts:1–7` locks the set to `channel.in|channel.out|router.in|router.out|agent.error`. `event-kind-vocabulary.md` §2: `router.out` is success-only, produced by `withMemoryLog`; `router.in` is produced by `instrumentRouter`; failures bubble as `agent.error`; **no `router.error`**. `src/integration/runtime.ts:41–70` still ships a fallback allowlist with the old names — latent regression. `src/router/instrumented-router.ts:25–61` only writes logger/metrics, never appends `router.in`, so the §4 grep returns zero even after memory-router is conformed.

**B. Bus→agent dispatch race (not "never called").**
`BaseAgent.start()` (`src/agents/base-agent.ts:41`) does subscribe before `run()`, so `onMessage` is reachable in principle. The smoke zero-delivery has three compounding causes: (1) `src/cli/chat.ts:6–9` boots with no providers and no credentials, so `router.route()` throws on every prompt; (2) `src/cli/chat.ts:29–37` resolves on stdin `end` and immediately calls `runtime.shutdown()` with nothing awaiting in-flight dispatch; (3) `src/integration/runtime.ts:259–279` closes memory before the `onMessage` microtask chain can persist. Result: `channel.in` (written synchronously inside `bus.send`) is the only survivor.

**C. Reply-address convention is implicit.**
`src/agents/router-agent.ts:50–56` replies to `msg.from`; `src/channels/cli-stdio.ts:67,90–97` hard-codes `"cli"` as sender id **and** mailbox. It works by accident; no type, test, or doc pins the invariant.

## 2. Canonical fixes (file · behavior · test to turn green)
**A1. `src/router/memory-router.ts`** — success writes `router.out` with the §2 row-4 payload; **remove** the error-path `safeAppend` (let it throw; `agent.error` is owned by the seam). Test: `src/router/__tests__/memory-router.test.ts` — rename `router.route`→`router.out`, drop `router.error` expectations, add "failure propagates without memory write".

**A2. `src/router/instrumented-router.ts`** — accept `memory?: MemoryStore`; append `router.in` on entry; no write on error. Test: `src/router/__tests__/instrumented-router.test.ts` — add "writes router.in once on entry"; assert no event on error.

**A3. `src/integration/runtime.ts`** — delete `ALLOWED_EVENT_KINDS`/`fallbackAssertEventKind`/dynamic-import (lines 41–70); static-import `assertEventKind`; plumb `memory` into `instrumentRouter`. Test: `src/integration/__tests__/runtime-event-kinds.test.ts` — after one successful prompt the `events` table contains exactly `{channel.in, router.in, router.out, channel.out}` in causal order; after one failing prompt exactly `{channel.in, router.in, agent.error, channel.out}`.

**B1. `src/cli/chat.ts`** — lift the provider + credential construction from `src/cli/instrumented-main.ts` into `runChat`; pass to `bootRuntime`. Gate on `CredentialStore.list()` and print "no providers configured" instead of crashing.

**B2. `src/integration/runtime.ts`** — replace the line-236 handler with an explicit dispatch wrapper: append `channel.in`, then `try { await agent.onMessage(msg) } catch { append agent.error; send error reply to msg.from }`. Track returned promises in an in-flight `Set`. **`shutdown()` must `await Promise.allSettled([...inFlight])` before `memory.close()`.** Order: unsubscribe → drain → channel.stop → agent.stop → abort → memory.close.

**B3. Single mailbox owner.** Add `autoSubscribe?: boolean` to `BaseAgent` (`src/agents/base-agent.ts`); `RouterAgent` opts out so the runtime seam is the sole `"router"` listener and can wrap dispatch in the error boundary. Test: `src/integration/__tests__/runtime-dispatch.test.ts` — fake provider on a controllable deferred proves: one prompt → one `onMessage` → one completion → shutdown waits for the dispatch promise.

**C1. `src/channels/cli-stdio.ts` + `src/channels/types.ts`** — add a `replyMailbox` field set at construction, used for both `bus.subscribe` and the `from:` on outbound prompts. Typedoc on `AgentMessage.from`: "return-address mailbox; receiving agent MUST reply to `msg.from`; channels MUST subscribe to the mailbox they set as `from`." Test: `src/channels/__tests__/cli-stdio.test.ts` — construct with `replyMailbox: "cli-7"`; assert completion reaches stdout.

## 3. Vocabulary decision (inbox §3)
**Keep `event-kinds.ts`; change `memory-router.ts` + `runtime.ts` to conform.** `event-kind-vocabulary.md` §1/§4 freezes the 5-kind set and requires an architect slice + retention + metrics migration before any addition — adding `router.route`/`router.error` would skip that gate. The locked names compose (`channel.in/out` ↔ `router.in/out`); `route` is a verb, not a seam boundary. `router.error` is redundant with `agent.error` and breaks the §4 grep's "one row = one real failure" invariant. The offending strings predate the lock — this is the conforming-pass the lock slice always implied, not a vocabulary change.

## 4. Sub-slices for cycle-14
1. **`phase3-bugfix-vocab`** — Fix A1+A2+A3. Owner: engineer-router.
2. **`phase3-bugfix-dispatch`** — Fix B1+B2+B3. Owner: engineer-router (sequential after slice 1 to avoid merge conflict in `runtime.ts`).
3. **`phase3-bugfix-return-address`** — Fix C1. Owner: engineer-floor (parallel with 1+2).
4. **`phase3-bugfix-smoke-rerun`** — re-run §4 against real ollama, attach row-count diff to `phase3-acceptance.md` §7.3. Owner: reviewer.

## 5. Risks and non-goals
- **Non-goal:** scheduler or channel-ABI rework. Bugs are local to the runtime seam.
- **Risk:** removing `BaseAgent` self-subscribe breaks bare-agent tests in `src/agents/__tests__`. Audit in slice 2; migrate to `autoSubscribe: true`.
- **Risk:** provider-lift in B1 may hit missing credentials on fresh installs — mitigated by the `CredentialStore.list()` gate.
- **Non-goal:** editing `phase3-acceptance.md` §4. The smoke script is correct; the runtime must conform to it.
