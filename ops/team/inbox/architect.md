# Task 008 — architect

Contract: ops/contracts/architect.contract.md
Slice: phase3-integration-plan
Branch: codex/phase3-integration-plan (worktree /home/jason/code/argent-lite-cli)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/phase3-integration-plan.md

## Goal

Write `ops/projects/phase3-integration-plan.md` (≤150 lines): the
concrete plan for tying the Phase 3 pieces together (memory, channels,
agent-router wiring, CredentialStore injection). Explain:

1. **Dependency graph** between memory-store, channels, router-agent-live,
   and the existing agents + scheduler. ASCII diagram.
2. **First runtime slice** — a single end-to-end flow: stdin → CLI channel
   → RouterAgent → Router → Ollama → stdout, with memory-store
   capturing the interaction.
3. **Dogfooding plan** — what's the smoke test that proves it works?
4. **Acceptance criteria** for the phase-3 gate.
5. **Open questions** (retention defaults, channel auth, etc.).

SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
