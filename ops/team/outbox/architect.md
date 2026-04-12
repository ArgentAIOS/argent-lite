I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary

Kiosk v0 is specced as a voice-first Echo-Dot-class appliance on Pi 5 +
7" 1024×600 touchscreen. Push-to-talk only in cycle-21; wake-word,
camera presence, and offline STT are pushed to cycle-22 sub-slices. The
orb is an iframe of the argentos dashboard at
`:8080?kiosk=1&piProfile=1`; the touchscreen owns onboarding and a
status strip, nothing more.

## Rationale

- State machine, screen layout, PTT contract, voice pipeline, config
  surface, onboarding wireframe, sub-slice list, and acceptance criteria
  all delivered in `ops/projects/kiosk-v0-design.md` (170 lines, under
  the 180-line cap named in the inbox).
- Voice-in and voice-out are modeled as new ChannelRegistry entries so
  they compose with the `channels-lite` work already merged (REGISTRY
  slice `channels-lite-design`, cycle-20).
- Event kinds `voice.in.start` / `voice.in.end` / `voice.out.done` are
  declared kiosk-internal and explicitly do not extend the locked
  runtime vocabulary from `event-kind-lock`.
- Provider secrets reuse the existing AES-256-GCM file backend from
  `provider-auth`; no new secret store is introduced.
- Architect contract (`ops/contracts/architect.contract.md`) forbids
  writing application code — this memo only specifies structure,
  candidate file paths, and acceptance gates. No `src/*` was touched.
- Standing guidance honored: zero application code is assumed (§10
  gates the first runtime test to the implementation slice), and the
  Mac-station patrol model is called out as non-applicable in §11.

## Risks and non-goals

- Non-goals: wake-word, camera presence, offline STT, Mac dashboard
  edits — all deferred to cycle-22 sub-slices.
- Risk: ElevenLabs streaming latency may miss the 6s p50 budget on Pi;
  must be measured in cycle-21 smoke.
- Risk: arecord/aplay vs parec/paplay coexistence on Pi OS PulseAudio;
  fallback declared in §7.
- Risk: operator may eventually want an offline-only mode; not in v0.

## Recommended follow-on slices (names only, no claims)

- `kiosk-v0-impl` — engineer slice for §8 file areas + §10 gates
- `kiosk-wake-word` — cycle-22
- `kiosk-camera-presence` — cycle-22
- `kiosk-aevp-embed` — cycle-22
- `kiosk-stt-offline` — cycle-22
- `kiosk-onboarding-impl` — cycle-22

## Files touched

- `ops/projects/kiosk-v0-design.md` (new, 170 lines)
- `ops/team/outbox/architect.md` (this file)

## Contract trace

`ops/contracts/architect.contract.md` → `ops/team/inbox/architect.md`
(task 021, slice `kiosk-v0-design`).

## Validation

- `wc -l ops/projects/kiosk-v0-design.md` → 170 (under 180-line cap).
- No `package.json` edits; architect contract forbids builds/tests on
  design-only slices. `pnpm` not run.

## Blockers

None.
