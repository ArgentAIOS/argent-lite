# Deploy Design — Argent Lite on Raspberry Pi 5

**Slice:** deploy-design · **Status:** design memo (no impl claimed)
**Target:** Debian 12 / Pi 5 / `pi5miniAI`, Node 22, pnpm 10
**Scope:** unattended persistent-service run of a built Argent Lite tree.
Hailo-10H bring-up is tracked separately.

## 1. Packaging

- **Chosen:** `pnpm build` → `dist/` (tsc) + `node dist/cli/main.js`. No
  single-binary bundler in this slice.
- **Rejected:** `pkg` (unmaintained on Node 22) and `esbuild --bundle` as a
  shipping format — both lose source maps and complicate Hailo native
  bindings landing 2026-04-12. Revisit post-Hailo.
- Install tree = git clone at `/opt/argent-lite`, deps via
  `pnpm install --prod --frozen-lockfile`.

## 2. Systemd unit (`deploy/argent-lite.service`)

```
[Unit]
Description=Argent Lite runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=argent
Group=argent
WorkingDirectory=/opt/argent-lite
EnvironmentFile=/etc/default/argent-lite
ExecStart=/usr/bin/node dist/cli/main.js chat --mode=${ARGENT_MODE}
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/argent-lite /var/log/argent-lite
PrivateTmp=true
[Install]
WantedBy=multi-user.target
```

Dedicated `argent` system user. `ARGENT_MODE` = `satellite` | `standalone`.

## 3. Config

- **Primary:** `/etc/argent-lite/config.json`, root-owned, readable by `argent`.
- **Fallback:** `$HOME/.argent-lite/config.json` for operator dev runs.
- Loader precedence (from `config-loader-design.md`): CLI > env > `/etc` > `~`.
- Systemd unit does not pass `--config`; loader picks `/etc` as `argent` user.

## 4. Secrets

- `ARGENT_MASTER_KEY` (AES-256-GCM key for credential store) lives in
  `/etc/default/argent-lite`, mode `0600`, owned `root:argent`, wired as the
  systemd `EnvironmentFile`. Never checked in.
- `deploy/env.example` ships variable names only.
- Rotation governed by the existing credential-rotation slice.

## 5. Logging / rotation

- stdout/stderr → `journald` via `StandardOutput=journal`. No app log files.
- Rotation via `SystemMaxUse=500M` in
  `/etc/systemd/journald.conf.d/argent-lite.conf`.
- obs-logger already emits JSON; `journalctl -u argent-lite -o json` is the
  query surface.

## 6. Upgrade path

```
sudo systemctl stop argent-lite
cd /opt/argent-lite
sudo -u argent git fetch --tags
sudo -u argent git checkout <tag>
sudo -u argent pnpm install --prod --frozen-lockfile
sudo -u argent pnpm build
sudo systemctl start argent-lite
```

Wrapped by `scripts/install.sh upgrade <tag>` (candidate, not in this slice).

## 7. Health check

- Liveness: `systemctl is-active argent-lite` (systemd restarts on failure).
- Smoke: `scripts/phase3-smoke.sh` (exists) run post-upgrade by operator.
- Follow-on: wire `curl localhost:<port>/health` into `ExecStartPost=` once
  the router HTTP port is fixed in config.

## 8. Rollback

- Deploys are git tags (`v0.x.y`). Rollback = `git checkout <prev-tag>` + redo
  steps 6.4–6.6. SqliteMemoryStore schema changes must stay forward-only and
  additive until a rollback-migration slice exists.

## 9. Candidate follow-on files (NOT created in this slice)

- `scripts/install.sh` — idempotent installer (user, clone, unit, build, enable).
- `deploy/argent-lite.service`, `deploy/env.example`,
  `deploy/journald-argent-lite.conf`.

## Risks & non-goals

- **Non-goal:** containerization. Pi 5 deploy is bare-metal by operator choice.
- **Risk:** Hailo-10H driver lands 2026-04-12; unit may need
  `DeviceAllow=/dev/hailo0 rw` once the device node is known.
- **Risk:** `/opt/argent-lite` as a git checkout blurs "artifact" vs "source".
  Acceptable for single-Pi; revisit for multi-host.
- **Mac-station mismatch:** none — Pi-only, no two-station patrol assumption.

## Recommended follow-on slices (names only)

- `deploy-installer-impl` — `scripts/install.sh` + `deploy/*` files.
- `deploy-health-endpoint` — fix router health port, wire `ExecStartPost`.
- `deploy-rollback-migrations` — SqliteMemoryStore forward/back migrations.
- `deploy-hailo-device-acl` — systemd `DeviceAllow` after 2026-04-12.
