I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Verdict: FAIL (2 of 4 branches)

Four branches reviewed for cycle-21 kiosk v0 (task 021). Two pass
(kiosk-v0-design, kiosk-ui-v0); two fail on event-kind lock violations
and Channel interface non-conformance (voice-out-elevenlabs,
voice-in-groq). All four carry stale base commits requiring rebase.

---

## F0 — CRITICAL: stale fork point (all 4 branches)

All four branches fork from `9ac72aa` (cycle-21 dispatch). The
integration branch `codex/ops-team-bootstrap` has since advanced to
`089c506` with two commits:

- `568da08` — v0.1.0: full README + MIT LICENSE + all-service controls
  in pi-dashboard
- `089c506` — fix: init wizard syncs API keys to argentos-core gateway

Merging any branch as-is would **delete LICENSE**, **truncate
README.md** (292 → 3 lines), **regress dashboard.py** (removes systemd
generic-service controls, scope detection, per-service
start/stop/restart UI, strips 8-entry SERVICES list to 6, removes
per-service control API endpoint), and **remove gateway sync from
src/cli/init.ts** (76 lines deleted).

Violates `never-do.md`: "Never mix unrelated repo changes into one
handoff packet." Rebase onto `089c506` required before merge.

---

## Branch 1: codex/kiosk-v0-design (503ccd9) — PASS with notes

**Commit:** `503ccd9` — "kiosk-v0-design: architect memo for Echo-Dot
kiosk (task 021)". Co-Authored-By trailer present.

**Files:** `ops/projects/kiosk-v0-design.md` (new, 170 lines),
`ops/team/outbox/architect.md` (updated). Only `ops/` files touched —
honors architect contract ("no application code").

### Findings

- PASS: Design doc covers state machine (4 states, 3 timeouts), screen
  layout (1024×600), voice pipeline contract, config surface, onboarding
  wireframe, acceptance criteria (7 gates), risks/non-goals. Well
  structured, 170 lines (under 180-line cap).
- PASS: No `src/` touched — architect contract honored.
- PASS: Outbox has correct confirmation line, contract trace, rationale.
- PASS: Mac-station mismatch acknowledged in risks (§11).

### Notes (non-blocking)

- `kiosk-v0-design.md:90` — References "the existing ChannelRegistry
  from the channels-lite slice." **No ChannelRegistry class exists** on
  `codex/ops-team-bootstrap`. Verified: `src/channels/types.ts` exports
  `Channel`, `ChannelBus`, `ChannelOptions` — no registry. Fabricated
  reference; engineer must not rely on it.
- `kiosk-v0-design.md:82-93` — Declares event kinds `voice.in.start`,
  `voice.in.end`, `voice.out.done` as "kiosk-internal." These are not in
  the locked vocabulary (`src/runtime/event-kinds.ts`: `channel.in`,
  `channel.out`, `router.in`, `router.out`, `agent.error`). Neither
  engineer implementation uses these kinds either — mismatch between
  design and implementation.
- `kiosk-v0-design.md:65` — Wireframe shows "HOLD TO TALK" but
  kiosk-ui-v0 HTML renders "Tap to Talk." Cosmetic mismatch.
- `kiosk-v0-design.md:95-99` — Voice pipeline contract specifies
  `trace_id` propagation. Neither voice channel implementation includes
  trace_id.

### Missing references

- `ChannelRegistry` — does not exist on `codex/ops-team-bootstrap`.

---

## Branch 2: codex/kiosk-ui-v0 (fde78e6) — PASS

**Commit:** `fde78e6` — "kiosk-ui-v0: full-screen HTTP kiosk on
127.0.0.1:7788". Co-Authored-By trailer present.

**Files:** `src/cli/kiosk.ts`, `src/kiosk/handlers.ts`,
`src/kiosk/server.ts`, `src/kiosk/index.ts`, `src/kiosk/index.html`,
`deploy/argent-lite-kiosk.desktop`, `tests/kiosk/handlers.test.ts`,
`tests/kiosk/server.test.ts` (8 new files, 918 insertions).

### Findings

- **State machine** (`handlers.ts`): 4-state model
  (idle/listening/thinking/speaking). `talkStart` gated on idle,
  `talkEnd` gated on listening, errors reset to idle. Callbacks injected
  via `KioskHandlerOptions`. Tests cover all transitions and error paths
  (10 tests).
- **HTTP server** (`server.ts`): Loopback-only bind (`127.0.0.1:7788`).
  Host-header validation rejects non-loopback with 403. SSE `/events`
  endpoint with `unref()`'d tick timer. Proper `no-store` cache headers.
  Tests cover HTML, status, talk, interrupt, SSE, host rejection, 404
  (7 tests, 17 total kiosk tests).
- **Kiosk HTML** (`index.html`): Touch-optimized (pointer events,
  `touch-action: manipulation`). CSS animations per state (breath for
  idle, spin for listening, fast spin for thinking, pulse for speaking).
  Standalone gradient disc instead of argentos iframe — acceptable v0
  simplification.
- **Desktop entry** (`argent-lite-kiosk.desktop`): Valid freedesktop
  format, Chromium kiosk mode pointing at loopback.
- No event-bus coupling — purely HTTP UI layer. Clean boundary.

### Minor notes (non-blocking)

- `server.ts:35-44` — `resolveDefaultIndexHtmlPath` returns first
  candidate path even if no candidate exists on disk; subsequent
  `readFile` will throw unhelpful ENOENT. Minor.
- `handlers.ts:93-102` — `talkEnd` sets state to `"thinking"` then
  immediately resolves `stopCapture`, advancing to `"speaking"` in same
  tick. Thinking state is unobservable via SSE. Fine for v0 but will
  need rework when real voice pipeline is integrated.
- No automatic `speaking → idle` transition. Must be wired when
  voice-out channel is integrated.

### Missing references: none.
### Validation: not run by reviewer (task specifies outbox-only).

---

## Branch 3: codex/voice-out-elevenlabs (d69fa43) — FAIL

**Commit:** `d69fa43` — "voice-out-elevenlabs: add ElevenLabs TTS
voice-out channel". Co-Authored-By trailer present.

**Files:** `src/channels/voice-out.ts` (132 lines),
`tests/channels/voice-out.test.ts` (182 lines, 3 tests).

### Blocking defects

- `voice-out.ts:27-34` — Type guard matches `kind === "completion"`.
  **Not in locked vocabulary.** Locked kinds per
  `src/runtime/event-kinds.ts`: `channel.in`, `channel.out`, `router.in`,
  `router.out`, `agent.error`. Must use `"router.out"` or `"channel.out"`.

- `voice-out.ts:42-47` — Matches `kind === "error"`. Locked spelling is
  `"agent.error"`.

- `voice-out.ts` — Defines ad-hoc bus interface
  `{ subscribe(id, h): () => void }` instead of `ChannelBus` from
  `src/channels/types.ts` (which requires typed `AgentMessage` and
  exposes both `send()` and `subscribe()`). Does not implement `Channel`
  interface (missing `readonly id: string`, different method signatures).

- `voice-out.ts` — Never emits `voice.out.done` event. Design doc
  §5 specifies emission after TTS stream completes. Required for
  kiosk speaking→idle transition.

### Non-blocking notes

- `voice-out.ts:88` — Silently swallows non-ok ElevenLabs responses
  (`if (!res.ok || res.body === null) return;`). TTS failures invisible.
- `voice-out.ts` — `now` option in `VoiceOutOptions` accepted but never
  used. Dead parameter.
- `voice-out.ts:75-78` — `ensureAplay()` reuses single long-lived aplay
  stdin. If aplay crashes, subsequent writes silently fail with no
  recovery.

### Rules violated

- `src/runtime/event-kinds.ts` lock: uses `"completion"` and `"error"`.
- `src/channels/types.ts`: does not implement `Channel` interface.
- Design doc §5: missing `voice.out.done` emission.

---

## Branch 4: codex/voice-in-groq (48bdc96) — FAIL

**Commit:** `48bdc96` — "voice-in-groq: arecord → Groq whisper-large-v3
voice-in channel". Co-Authored-By trailer present.

**Files:** `src/channels/voice-in.ts` (203 lines),
`tests/channels/voice-in.test.ts` (178 lines, 4 tests).

### Blocking defects

- `voice-in.ts:179` — Emits `{ kind: "prompt" }`. **Not in locked
  vocabulary.** Must use `"channel.in"`.

- `voice-in.ts` — Defines own `VoiceInBus` (`{ send(msg) }`) instead of
  `ChannelBus` from `src/channels/types.ts` (which requires typed
  `AgentMessage`). Does not implement `Channel` interface (missing
  `readonly id: string`).

- `voice-in.ts` — Emitted message lacks `trace_id`. Design §5
  and acceptance gate §10.2 require trace_id propagation.

### Non-blocking notes

- `voice-in.ts:126-131` — Creates `PassThrough` for stderr drain that
  is written to but never consumed. Buffers indefinitely. Should use
  `proc.stderr.resume()` instead.
- `voice-in.ts:114-116` — `Buffer.from(chunk)` on value already typed
  as `Buffer | string`. Redundant copy when chunk is already a Buffer.

### Rules violated

- `src/runtime/event-kinds.ts` lock: uses `"prompt"` instead of
  `"channel.in"`.
- `src/channels/types.ts`: does not implement `Channel` interface.
- Design doc §5: missing `trace_id`.

---

## Summary for threadmaster

### Rebase required (all four branches)

All branches fork from `9ac72aa`; must rebase onto current
`codex/ops-team-bootstrap` HEAD (`089c506`) before merge. Without
rebase, merging any branch will revert LICENSE, README, dashboard
systemd controls, and init gateway sync.

### Blocking defects (branches 3 and 4)

1. **Event-kind lock violation.** `voice-out` uses `"completion"` and
   `"error"`; `voice-in` uses `"prompt"`. All must use locked vocabulary
   from `src/runtime/event-kinds.ts`.
2. **Channel interface non-conformance.** Both voice channels define
   ad-hoc bus interfaces instead of implementing `Channel` from
   `src/channels/types.ts`.
3. **Missing trace_id** in `voice-in` messages (design §5, gate §10.2).
4. **Missing voice.out.done emission** in `voice-out` (design §5).

### Branches ready to merge (after rebase)

- `codex/kiosk-v0-design` — PASS with notes.
- `codex/kiosk-ui-v0` — PASS.

### Branches requiring rework

- `codex/voice-out-elevenlabs` — implement `Channel` interface, use
  locked event kinds, emit `voice.out.done`, add error visibility.
- `codex/voice-in-groq` — implement `Channel` interface, use locked
  event kinds, add `trace_id`, fix stderr drain.

### Slices not registered

None of the four branch slices appear in `ops/slices/REGISTRY.md`.
Threadmaster should register them before merge.

## Files touched

- `ops/team/outbox/reviewer.md` — this file (overwritten per contract).

No other files modified. No commits. No PR (task specifies outbox only).

## Contract trace

`ops/contracts/reviewer.contract.md` → `ops/team/inbox/reviewer.md`
(task 021, slice `cycle21-review`).

## Validation

Not run — task specifies "Single pass, outbox only. NO commit. NO PR."
and does not authorize firsthand validation. Engineer claims noted but
unverified.

## Blockers

None (review complete; rework is on the engineers, not a reviewer
blocker).
