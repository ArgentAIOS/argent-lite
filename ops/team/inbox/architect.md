# Task 021 — architect

Contract: ops/contracts/architect.contract.md
Slice: kiosk-v0-design
Branch: codex/kiosk-v0-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/kiosk-v0-design.md

## Context

Operator confirmed the Echo-Dot form factor: 7" touchscreen, mic, speaker,
camera, voice-first ambient appliance. Walk up and talk. Touchscreen is
for onboarding + glance-able status. Mac dashboard stays separate.

## Goal

Write `ops/projects/kiosk-v0-design.md` (≤180 lines) — the first concrete
spec for the kiosk.

1. **State machine** (ASCII): idle → listening → thinking → speaking → idle, with timeouts and push-to-talk entry.
2. **Screen layout** for 7" @ 1024×600 (typical Pi touchscreen):
   - Top 60%: AEVP orb (iframe of argentos dashboard at :8080 with `?kiosk=1&piProfile=1`)
   - Middle 20%: single-line status text
   - Bottom 20%: giant push-to-talk button + small gear icon (settings)
3. **Push-to-talk v1**, wake-word deferred to cycle-22. Button sends `voice.in.start`, release sends `voice.in.end`.
4. **Voice pipeline contract**:
   - `voice-in` channel: `arecord` → WAV buffer → Groq whisper-large-v3 → bus `kind: "prompt"` `payload: {prompt, trace_id}`
   - `voice-out` channel: bus `kind: "completion"` → ElevenLabs TTS → `aplay` / `paplay` stream chunks
5. **Onboarding-via-touchscreen** wireframe: 5 steps (mode → providers → api keys via on-screen keyboard → master key generation → satellite Mac URL optional).
6. **Config surface**: new `kiosk:` block in `ArgentConfig` schema.
7. **Candidate file areas**: `src/kiosk/`, `src/channels/voice-in.ts`, `src/channels/voice-out.ts`.
8. **Sub-slices** for cycle-22 (wake-word, camera presence, AEVP embed, offline STT fallback).
9. **Acceptance criteria** for the kiosk-v0 gate.

SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap. Deadline: before next cron tick.
