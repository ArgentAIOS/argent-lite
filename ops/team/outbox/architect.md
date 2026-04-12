I have read `ops/` and am operating under contract:
`ops/contracts/architect.contract.md`.

## Decision summary

Delivered the security threat model for Argent Lite on a Pi at
`ops/projects/security-threat-model.md` (118 lines, under the 150 cap).
STRIDE-organized, trust boundaries enumerated, shipped mitigations
cross-referenced to PRs #3/#31/#41, seven unmitigated gaps ordered for
Phase 5, and non-goals called out.

## Rationale

- Contract scope: architect produces short decision memos, no app code
  (`ops/contracts/architect.contract.md`).
- Asset list covers the four classes the inbox named: credentials,
  `memory.sqlite`, config, satellite traffic (inbox task 019).
- Trust boundaries drawn at the four seams Phase 3 actually crosses
  (CLI user, cloud providers, Mac satellite, local OS), matching the
  runtime seam locked by PR #41 (`phase3-runtime-slice`).
- STRIDE threats trace to concrete code paths already in-tree; no
  hypothetical runtime invented.
- Shipped mitigations cite the exact PRs the inbox named: HMAC auth
  #31, AES-256-GCM credential file #3, sole-constructor runtime #41.
- Gap ordering weights likelihood × operator data exposure:
  memory.sqlite at-rest encryption first (full prompt history
  disclosure on disk loss), log scrubbing second (cheap regression
  guard), TLS third.
- Non-goals explicitly exclude supply chain, multi-tenant, and
  post-Hailo side channels — keeps scope honest per architect contract
  "do not design downstream of undecided scope."

## Risks and non-goals

- **Risk:** Gap G1 (at-rest memory encryption) is already live risk —
  every Phase 3 run writes prompts to unencrypted sqlite today. Phase 5
  should land this before any non-local deployment.
- **Risk:** Satellite TLS gap (G3) means LAN attackers still see
  prompt/completion bodies even with HMAC integrity.
- **Non-goal clarified:** The Mac-station patrol model from the
  runbooks does not appear in the threat model because it does not map
  to a Pi-only deploy (per `ops/CLAUDE.md` known-issue note).
- **Non-goal clarified:** Hailo-10H side channels deferred until
  hardware lands 2026-04-12.

## Files touched

- `ops/projects/security-threat-model.md` (created, 118 lines)
- `ops/team/outbox/architect.md` (this file)

Surface matches inbox authorization exactly.

## Recommended follow-on slices (names only, not claimed)

- `memory-at-rest-encryption` — gap G1
- `log-redactor` — gap G4
- `satellite-tls` — gap G3
- `credential-rotation-policy` — gap G2
- `satellite-rate-limit` — gap G5
- `provider-circuit-breaker` — gap G6
- `audit-log-chain` — gap G7 (Phase 5, after tools land)

## Validation

No `package.json` changes in this surface; architect contract forbids
running builds or tests. Skipped per contract. Line cap verified:
`wc -l` = 118 (≤150).

## Blockers

None.

## Contract reference

`ops/contracts/architect.contract.md` →
`ops/contracts/team-onboarding.contract.md`. Task:
`ops/team/inbox/architect.md` (Task 019, slice `security-threat-model`).
