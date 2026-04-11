# Task 018 — architect

Contract: ops/contracts/architect.contract.md
Slice: deploy-design
Branch: codex/deploy-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/deploy-design.md

## Goal

`ops/projects/deploy-design.md` (≤120 lines): how Argent Lite gets
deployed to a Pi for continuous operation.

1. Packaging: `pnpm build` → `dist/`. Consider `pkg` or `esbuild --bundle` for single-binary.
2. Systemd unit for persistent run (`argent-lite.service`).
3. Config location: `/etc/argent-lite/config.json` or `~/.argent-lite/config.json`.
4. Secrets: `ARGENT_MASTER_KEY` via env file `/etc/default/argent-lite` (mode 0600).
5. Log rotation: `journald` capture via systemd.
6. Upgrade path: `git pull && pnpm install && pnpm build && systemctl restart`.
7. Health check: `systemctl status` + `scripts/phase3-smoke.sh`.
8. Rollback: previous git tag.
9. Candidate files: `scripts/install.sh`, `deploy/argent-lite.service`, `deploy/env.example`.

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
