I have read ops/ and am operating under contract:
ops/contracts/reviewer.contract.md.

## Verdict: FAIL (2 of 4 branches)

Independent review of 4 cycle-21 kiosk-v0 branches (task 021).
All claims verified against `codex/ops-team-bootstrap` HEAD (`089c506`).
Fork point for all 4 branches: `9ac72aa`.

---

## F0 — Stale fork point (all 4 branches)

All 4 branches fork from `9ac72aa`. Integration branch has since advanced
to `089c506` (+2 commits: `568da08` v0.1.0 README/LICENSE/dashboard,
`089c506` init gateway auth sync). Merging any branch as-is would revert:
LICENSE (deleted), README.md (292→3 lines), deploy/pi-dashboard/dashboard.py
(loses systemd controls + service entries), src/cli/init.ts (removes
gateway auth sync).

**Action required:** rebase all 4 branches onto `089c506` before merge.

---

## Branch 1: codex/kiosk-v0-design (503ccd9) — PASS

**Files:** `ops/projects/kiosk-v0-design.md` (new, 170 lines),
`ops/team/outbox/architect.md` (updated).

- Architect contract honored — design only, no application code authored.
  The init.ts deletion and other collateral is the F0 fork-point issue,
  not architect work.
- Design doc covers: 4-state machine with 3 timeouts, 1024×600 screen
  layout, voice-in/voice-out pipeline contracts, `kiosk:` config block,
  5-step onboarding wireframe, candidate file areas, cycle-22 sub-slices,
  10 acceptance criteria, risks/non-goals.
- Outbox has confirmation line, contract trace, file list.

**Non-blocking notes:**

- `kiosk-v0-design.md:90` — references "existing ChannelRegistry from
  channels-lite slice." Verified: **no ChannelRegistry class exists** on
  ops-team-bootstrap. `src/channels/types.ts` exports `Channel`,
  `ChannelBus`, `ChannelOptions` but no registry. Fabricated name —
  engineer must not rely on it.
- `kiosk-v0-design.md:82-93` — declares event kinds `voice.in.start`,
  `voice.in.end`, `voice.out.done` as kiosk-internal. These are not in
  the locked vocabulary (`src/runtime/event-kinds.ts`: channel.in,
  channel.out, router.in, router.out, agent.error). Neither voice
  channel implementation uses these kinds — design/impl gap.
- `kiosk-v0-design.md:65` — wireframe says "HOLD TO TALK"; kiosk-ui-v0
  HTML uses "Tap to Talk." Cosmetic mismatch.
- `kiosk-v0-design.md:95-99` — specifies `trace_id` propagation through
  voice pipeline. Neither voice channel implements trace_id.
- `kiosk-v0-design.md:64` — orb iframe assumes argentos at `:8080`. On
  standalone Pi without argentos-core, iframe 404s. kiosk-ui-v0 correctly
  uses a standalone gradient disc instead.

**Missing references:** ChannelRegistry (fabricated name).

---

## Branch 2: codex/kiosk-ui-v0 (fde78e6) — PASS

**Files:** `src/cli/kiosk.ts`, `src/kiosk/handlers.ts`,
`src/kiosk/server.ts`, `src/kiosk/index.ts`, `src/kiosk/index.html`,
`deploy/argent-lite-kiosk.desktop`, `tests/kiosk/handlers.test.ts`,
`tests/kiosk/server.test.ts` (8 new files, 918 insertions).

- **State machine** (`handlers.ts`): 4-state (idle/listening/thinking/
  speaking), transitions correctly gated, errors reset to idle.
  10 handler tests cover all transitions + error paths.
- **HTTP server** (`server.ts`): loopback-only bind (`127.0.0.1`) +
  host-header validation (rejects non-loopback with 403). SSE `/events`
  with unref'd ticker. `no-store` cache headers. 7 server tests.
  Total: 17 tests across both files.
- **Kiosk HTML** (`index.html`): touch-optimized pointer events, CSS
  animations per state (breath idle, spin listening, pulse speaking),
  standalone gradient disc (no iframe dependency). Zero external deps.
- **Desktop entry** (`argent-lite-kiosk.desktop`): valid freedesktop
  format, Chromium kiosk flags.
- Clean HTTP boundary — no event-bus coupling. Good separation.

**Non-blocking notes:**

- `server.ts:47-63` — `resolveDefaultIndexHtmlPath` returns the first
  candidate path even if neither exists; `readFile` at startup throws
  an unhelpful ENOENT. Consider a clear error message.
- `server.ts:47-63` — `index.html` lives in `src/kiosk/`. Build pipeline
  does not copy it to `dist/`. Needs build config update at integration.
- `handlers.ts:68-73` — state is set to `"listening"` before awaiting
  `startCapture()`. Single-user PTT scenario makes races unlikely but
  worth noting.
- No `speaking → idle` auto-transition. Must be wired when voice-out
  channel integrates (voice.out.done → idle).

**Missing references:** none.

---

## Branch 3: codex/voice-out-elevenlabs (d69fa43) — FAIL

**Files:** `src/channels/voice-out.ts` (132 lines),
`tests/channels/voice-out.test.ts` (182 lines, 3 tests).

### Blocking defects

- `voice-out.ts:27-34` — type guard matches `kind === "completion"`.
  **Not in locked vocabulary.** `src/runtime/event-kinds.ts` locks to:
  `channel.in`, `channel.out`, `router.in`, `router.out`, `agent.error`.
  Must use `"router.out"` or `"channel.out"`.
- `voice-out.ts:42-47` — matches `kind === "error"`. Locked spelling is
  `"agent.error"`.
- `voice-out.ts` — defines ad-hoc bus interface
  `{ subscribe(id, h): () => void }` instead of `ChannelBus` from
  `src/channels/types.ts` (typed `AgentMessage`, exposes `send()` +
  `subscribe()`). Does not implement the `Channel` interface (missing
  `readonly id: string`, different method signatures).
- `voice-out.ts` — never emits `voice.out.done` event. Design doc §5
  requires emission after TTS stream completes. Needed for kiosk
  speaking→idle transition.

### Non-blocking notes

- `voice-out.ts:88` — silently swallows non-ok ElevenLabs responses
  (`if (!res.ok || res.body === null) return;`). TTS failures invisible.
- `voice-out.ts` — `now` option accepted but never used. Dead parameter.
- `voice-out.ts:69-73` — `ensureAplay()` reuses a single aplay stdin
  across calls. aplay exits when stdin stream closes; subsequent
  `speak()` calls write to the closed pipe with no reconnect logic.

### Rules violated

- `src/runtime/event-kinds.ts` lock: uses `"completion"` and `"error"`.
- `src/channels/types.ts`: does not implement `Channel` interface.
- Design doc §5: missing `voice.out.done` emission.

---

## Branch 4: codex/voice-in-groq (48bdc96) — FAIL

**Files:** `src/channels/voice-in.ts` (203 lines),
`tests/channels/voice-in.test.ts` (178 lines, 4 tests).

### Blocking defects

- `voice-in.ts:179` — emits `{ kind: "prompt" }`. **Not in locked
  vocabulary.** Must use `"channel.in"`.
- `voice-in.ts` — defines own `VoiceInBus` (`{ send(msg) }`) instead of
  `ChannelBus` from `src/channels/types.ts` (typed `AgentMessage`).
  Does not implement the `Channel` interface (missing `readonly id`).
- `voice-in.ts` — emitted message lacks `trace_id`. Design §5 and
  acceptance gate §10.2 require trace_id propagation.

### Non-blocking notes

- `voice-in.ts:126-131` — creates `PassThrough` for stderr drain that is
  written to but never consumed. Buffers indefinitely if stderr is
  verbose. Should use `proc.stderr.resume()`.
- `voice-in.ts:114-116` — `Buffer.from(chunk)` when chunk may already be
  a Buffer. Redundant copy on each data event.

### Rules violated

- `src/runtime/event-kinds.ts` lock: uses `"prompt"`.
- `src/channels/types.ts`: does not implement `Channel` interface.
- Design doc §5: missing `trace_id`.

---

## Summary for threadmaster

### Rebase required (all 4 branches)

Rebase onto `089c506` before any merge. Without rebase, merging reverts
LICENSE, README, dashboard systemd controls, and init gateway auth sync.

### Ready to merge (after rebase)

- `codex/kiosk-v0-design` — PASS with non-blocking notes.
- `codex/kiosk-ui-v0` — PASS with non-blocking notes.

### Require rework

- `codex/voice-out-elevenlabs` — implement `Channel` interface from
  `src/channels/types.ts`, use locked event kinds (`router.out` /
  `agent.error` not `completion` / `error`), emit `voice.out.done`,
  surface TTS error responses.
- `codex/voice-in-groq` — implement `Channel` interface from
  `src/channels/types.ts`, use locked event kind (`channel.in` not
  `prompt`), add `trace_id` to emitted messages, fix stderr drain.

### Slices not registered

None of the 4 branch slices appear in `ops/slices/REGISTRY.md`.
Register before merge.

## Files touched

- `ops/team/outbox/reviewer.md` — this file (overwritten per contract).

No other files modified. No commits. No PR (task specifies outbox only).

## Contract trace

`ops/contracts/reviewer.contract.md` → `ops/team/inbox/reviewer.md`
(task 021, slice `cycle21-review`).

## Validation

Not run — task specifies "Single pass, outbox only. NO commit. NO PR."
and does not authorize firsthand validation.

## Blockers

None (review complete; rework is on engineers).
