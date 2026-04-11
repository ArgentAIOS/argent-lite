# Task 007 — architect

Contract: ops/contracts/architect.contract.md
Slice: channels-lite-design
Branch: codex/channels-lite-design (worktree /home/jason/code/argent-lite-cli)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/architect.md
- ops/projects/channels-lite-design.md

## Goal

Write `ops/projects/channels-lite-design.md` (≤150 lines, research-planning §9 shape) covering Phase 3 channels:

1. Channel model — what is a channel? (CLI stdin/stdout, file-tail, HTTP endpoint, eventually Slack/email).
2. Channel ↔ agent contract — how does a channel deliver input to an agent and stream output back?
3. Initial phase-3 channels: `cli-stdio`, `file-watch`, `http-post`.
4. Candidate file areas: `src/channels/**`.
5. Phased sub-slices with dependencies.
6. Open questions (auth per channel? multi-tenant?).

SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
