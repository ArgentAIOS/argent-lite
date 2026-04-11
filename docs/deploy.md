# Argent Lite — Deploy Runbook

One-page operator runbook for installing, running, upgrading, and
uninstalling Argent Lite on a Debian/Raspberry Pi host under systemd.

## Prerequisites

- Debian 12 (or compatible). Raspberry Pi 5 supported.
- Node.js 22.x on `PATH`.
- pnpm 10.x on `PATH`.
- `rsync` installed.
- Root (sudo) access.

## Install

```bash
sudo ./scripts/install.sh
```

The installer:

1. Creates the `argent-lite` system user (idempotent).
2. Syncs the repo into `/opt/argent-lite` (excludes `.git`, `node_modules`, `dist`).
3. Runs `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm prune --prod`.
4. Creates `/var/lib/argent-lite` and `/var/log/argent-lite` owned by `argent-lite`.
5. Installs `deploy/argent-lite.service` to `/etc/systemd/system/`.
6. Installs `deploy/env.example` to `/etc/default/argent-lite.example`
   (never overwrites an existing live env file).
7. Runs `systemctl daemon-reload`.

The installer does **not** start the service. That is an operator step.

## Configure

```bash
sudo cp /etc/default/argent-lite.example /etc/default/argent-lite
sudo chown root:argent-lite /etc/default/argent-lite
sudo chmod 0640 /etc/default/argent-lite
sudoedit /etc/default/argent-lite
```

Required keys:

| Key | Purpose |
| --- | --- |
| `ARGENT_MODE` | `satellite` or `standalone` |
| `ARGENT_HOME` | data + state dir (default `/var/lib/argent-lite`) |
| `ARGENT_LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` |
| `ARGENT_MASTER_KEY` | AES-256-GCM key (`openssl rand -base64 32`) |

## Start

```bash
sudo systemctl enable argent-lite.service
sudo systemctl start argent-lite.service
```

## Health check

```bash
systemctl status argent-lite.service
journalctl -u argent-lite -n 100 --no-pager
journalctl -u argent-lite -f          # live tail
```

A healthy unit shows `active (running)` and a recent start timestamp.
Log lines are structured JSON when `ARGENT_LOG_LEVEL=info`.

## Upgrade

```bash
# From a fresh checkout of the new revision:
sudo systemctl stop argent-lite.service
sudo ./scripts/install.sh
sudo systemctl start argent-lite.service
```

The installer re-syncs `/opt/argent-lite` and reinstalls deps.
Operator env (`/etc/default/argent-lite`) and state (`/var/lib/argent-lite`)
are untouched.

## Rollback

1. `sudo systemctl stop argent-lite.service`
2. `git checkout <previous-good-sha>` in a working tree.
3. `sudo ./scripts/install.sh`
4. `sudo systemctl start argent-lite.service`

Because `/var/lib/argent-lite` is preserved across installs, state
(memory store, credential vault) survives rollback. Schema-breaking
changes are called out in the slice JOURNAL — check before rolling
back across such a boundary.

## Uninstall

```bash
sudo ./scripts/uninstall.sh
```

Removes: unit file, `/opt/argent-lite`, env example.
Preserves: `/etc/default/argent-lite`, `/var/lib/argent-lite`,
`/var/log/argent-lite`, the `argent-lite` user. Remove those manually
for a full wipe.

## Files owned by this runbook

- `deploy/argent-lite.service` — systemd unit
- `deploy/env.example` — env template
- `scripts/install.sh` — installer
- `scripts/uninstall.sh` — uninstaller
- `docs/deploy.md` — this file
