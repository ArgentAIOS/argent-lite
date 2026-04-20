# Kiosk v0 — Echo-Dot Form-Factor Design

**Slice:** kiosk-v0-design
**Branch:** codex/kiosk-v0-design
**Status:** design — no code yet
**Contract:** ops/contracts/architect.contract.md
**Date:** 2026-04-11

## 1. Goal

A voice-first ambient appliance running Argent Lite on a Pi 5 with a 7"
touchscreen (1024×600), mic array, speaker, and camera. Walk up and talk.
Touchscreen is for onboarding + glance-able status, not primary input.
Mac dashboard remains a separate satellite peer.

## 2. State machine

```
            push-to-talk pressed
   ┌───────────────────────────────┐
   │                               ▼
 ┌──────┐   release    ┌───────────┐   token stream   ┌──────────┐
 │ idle │◀─────────────│ listening │─────────────────▶│ thinking │
 └──────┘   2s silence └───────────┘                  └────┬─────┘
    ▲                                                      │
    │                                                      ▼
    │            TTS stream complete            ┌──────────────┐
    └────────────────────────────────────────────│   speaking   │
                                                 └──────────────┘
```

Timeouts (all configurable under `kiosk.timeouts`):

- `listening → idle` on 2s trailing silence OR button release
- `thinking → idle` on 20s router deadline (error toast)
- `speaking → idle` on TTS stream end OR user interrupt (button press)
- `idle → idle` ambient redraw every 30s (AEVP orb frame kick)

Entry: push-to-talk button (cycle-21). Wake-word deferred to cycle-22.

## 3. Screen layout (1024×600)

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│              AEVP ORB                    │  360px (60%)
│      (iframe argentos :8080              │
│        ?kiosk=1&piProfile=1)             │
│                                          │
├──────────────────────────────────────────┤
│   "Listening…"  |  "Thinking…"  |  …     │  120px (20%)
├──────────────────────────────────────────┤
│                                          │
│   ┌────────────────────────┐      ⚙     │  120px (20%)
│   │      HOLD TO TALK      │            │
│   └────────────────────────┘            │
└──────────────────────────────────────────┘
```

- Top 60% — iframe of argentos dashboard orb at `:8080?kiosk=1&piProfile=1`.
- Middle 20% — single-line status text bound to state machine.
- Bottom 20% — giant push-to-talk button + small gear icon (settings).

## 4. Push-to-talk v1

- Button press publishes `bus.emit({kind: "voice.in.start", trace_id})`.
- Button release publishes `bus.emit({kind: "voice.in.end", trace_id})`.
- `voice-in` channel owns arecord lifecycle between those two events.
- Wake-word ("hey argent") deferred to cycle-22 sub-slice.

## 5. Voice pipeline contract

### voice-in channel (`src/channels/voice-in.ts`)

```
voice.in.start  →  arecord -f S16_LE -r 16000 -c 1 → WAV buffer
voice.in.end    →  close buffer → POST Groq whisper-large-v3
                →  bus.emit({kind: "prompt", payload: {prompt, trace_id}})
```

### voice-out channel (`src/channels/voice-out.ts`)

```
bus.subscribe("completion")  →  ElevenLabs TTS stream (chunked)
                             →  pipe into aplay / paplay (alsa default)
                             →  bus.emit({kind: "voice.out.done", trace_id})
```

Both channels register through the existing ChannelRegistry from the
`channels-lite` slice. No new event kinds beyond `voice.in.start`,
`voice.in.end`, `voice.out.done` added to the locked vocabulary — those
are kiosk-internal and never leave the local bus.

## 6. Onboarding via touchscreen (wireframe, 5 steps)

1. **Mode** — Satellite or Standalone Lite. Two cards, tap to pick.
2. **Providers** — checkboxes for ollama (local), anthropic, openai, groq,
   elevenlabs. Satellite mode defaults to "inherit from Mac peer".
3. **API keys** — on-screen QWERTY keyboard for each enabled provider.
   Keys written via existing provider-auth AES-256-GCM file backend.
4. **Master key** — generate or paste. Display once, never again.
5. **Satellite pairing (optional)** — enter Mac peer URL + HMAC token,
   or skip to stay standalone.

All five steps reuse `config-loader` + `provider-auth` already merged.

## 7. Config surface — new `kiosk:` block in `ArgentConfig`

```ts
kiosk: {
  enabled: boolean;              // default false; true on Pi image
  display: { width: 1024, height: 600 };
  audio: {
    capture: "arecord" | "parec";
    playback: "aplay" | "paplay";
    sampleRate: 16000;
  };
  stt: { provider: "groq"; model: "whisper-large-v3" };
  tts: { provider: "elevenlabs"; voiceId: string };
  pushToTalk: { gpioPin?: number; touchButton: boolean };
  wakeWord: { enabled: false };  // cycle-22
  timeouts: { silenceMs: 2000; thinkingMs: 20000 };
  orbUrl: "http://localhost:8080/?kiosk=1&piProfile=1";
}
```

## 8. Candidate file areas (for engineer cycle-21+)

- `src/kiosk/` — state machine, UI host, onboarding flow
- `src/kiosk/ui/` — static HTML/CSS for the 7" screen (no React for v0)
- `src/channels/voice-in.ts`
- `src/channels/voice-out.ts`
- `src/config/schema.ts` — add `kiosk` block
- `tests/kiosk/state-machine.test.ts`

## 9. Sub-slices for cycle-22

- `kiosk-wake-word` — openWakeWord or porcupine on-device
- `kiosk-camera-presence` — camera-driven idle→attention transition
- `kiosk-aevp-embed` — harden argentos orb iframe for kiosk profile
- `kiosk-stt-offline` — whisper.cpp fallback when Groq unreachable
- `kiosk-onboarding-impl` — implement the 5-step flow from §6

## 10. Acceptance criteria (kiosk-v0 gate)

1. State machine unit tests cover all 4 transitions + 3 timeouts.
2. `voice-in` + `voice-out` channels register through ChannelRegistry
   and emit/consume the event kinds in §5 with trace_id propagation.
3. Push-to-talk round trip on Pi 5 hardware: press → whisper → router →
   completion → TTS → aplay, end-to-end under 6s p50.
4. `kiosk` config block validates through existing config-loader; bad
   config fails fast with a readable error.
5. 7" layout renders at 1024×600 without scroll; orb iframe loads the
   argentos dashboard with `?kiosk=1&piProfile=1`.
6. Onboarding wireframe reviewed by operator (implementation deferred).
7. `pnpm test` + `pnpm check` + `pnpm build` green on the implementation
   branch.

## 11. Risks and non-goals

- **Non-goal:** wake-word, camera presence, offline STT — all cycle-22.
- **Non-goal:** Mac dashboard changes. The orb iframe is read-only.
- **Risk:** ElevenLabs streaming latency on Pi may blow the 6s p50 budget
  under cloud-bound TTS. Mitigation: measure in cycle-21 smoke.
- **Risk:** arecord + aplay coexistence under PulseAudio on Pi OS is
  fiddly. Mitigation: default to `parec`/`paplay` if PulseAudio is
  detected at boot.
- **Risk:** Mac-station patrol model from older runbooks does not apply
  to kiosk; the kiosk is a Pi-only satellite peer.
