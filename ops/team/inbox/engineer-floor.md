# Task 018 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: deploy-artifacts
Branch: codex/deploy-artifacts (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- deploy/argent-lite.service
- deploy/env.example
- scripts/install.sh
- scripts/uninstall.sh
- docs/deploy.md

## Goal

1. **`deploy/argent-lite.service`** — systemd unit:
   - `[Unit]` description, after network.target
   - `[Service]` Type=simple, User=argent-lite, WorkingDirectory=/opt/argent-lite,
     ExecStart=/usr/bin/node /opt/argent-lite/dist/src/cli/chat.js,
     EnvironmentFile=/etc/default/argent-lite, Restart=on-failure,
     RestartSec=10s, StandardOutput=journal, StandardError=journal.
   - `[Install]` WantedBy=multi-user.target.
2. **`deploy/env.example`** — commented example env file with
   `ARGENT_MODE`, `ARGENT_HOME`, `ARGENT_LOG_LEVEL`, `ARGENT_MASTER_KEY`.
3. **`scripts/install.sh`** — bash `set -euo pipefail`:
   - Check running as root.
   - Create `argent-lite` system user if missing.
   - Create `/opt/argent-lite`, copy repo contents (minus node_modules),
     `pnpm install --prod --frozen-lockfile`, `pnpm build`.
   - Install unit file to `/etc/systemd/system/argent-lite.service`.
   - Install env example to `/etc/default/argent-lite.example` (never
     overwrites real env file).
   - `systemctl daemon-reload`, print next steps.
4. **`scripts/uninstall.sh`** — reverse of install, preserves
   `/etc/default/argent-lite` and `$ARGENT_HOME` data.
5. **`docs/deploy.md`** — one-page runbook: install, config, start,
   health check, upgrade, rollback, uninstall.

## Constraints

- Pure bash, no new deps.
- Scripts must be idempotent.
- Do NOT `systemctl start` in install.sh; just enable it with a
  prompt for operator to start manually.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
