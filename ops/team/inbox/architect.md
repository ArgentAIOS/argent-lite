# Task 015 — architect

Contract: ops/contracts/architect.contract.md
Slice: phase4-roadmap
Branch: codex/phase4-roadmap (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/phase4-roadmap.md

## Goal

`ops/projects/phase4-roadmap.md` (≤120 lines): rough roadmap for
Phase 4 work beyond the Phase 3 gate. Cover:

1. Deferred items from `phase3-complete.md` — what should land first.
2. **Satellite runtime wiring**: how the Pi acts as a satellite of a
   Mac Argent brain, using the HTTP protocol + HMAC auth from PR #31.
3. **Multi-agent fan-out**: scheduler + topology upgrades to run N
   concurrent agents.
4. **Real Hailo integration**: replace the stub once the HAT+ 2 lands.
5. **Retention telemetry**: surface memory store metrics via obs-metrics.
6. **Channel file-watch**: the second concrete channel after stdio + http.
7. Proposed slice order with dependencies.
8. Risks + open questions.

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
