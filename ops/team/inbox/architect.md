# Task 019 — architect

Contract: ops/contracts/architect.contract.md
Slice: security-threat-model
Branch: codex/security-threat-model (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/security-threat-model.md

## Goal

`ops/projects/security-threat-model.md` (≤150 lines): the security
threat model for Argent Lite running on a Pi.

1. Assets: credentials, memory.sqlite (contains prompts + completions),
   config, satellite traffic.
2. Trust boundaries: CLI user, cloud providers, Mac satellite, local OS.
3. Threats per STRIDE category (spoofing/tampering/repudiation/info-disclosure/DoS/elevation).
4. Mitigations already shipped: HMAC satellite auth (#31), AES-256-GCM
   credential file (#3), runtime.ts as sole constructor (#41).
5. Gaps: no at-rest encryption for memory.sqlite, no secret rotation
   enforcement, no TLS on satellite HTTP, no log scrubbing.
6. Priority ordered gap fixes for Phase 5.
7. Non-goals (what's out of scope for this threat model).

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
