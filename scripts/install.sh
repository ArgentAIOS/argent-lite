#!/usr/bin/env bash
# Argent Lite installer. Idempotent. Run as root.
set -euo pipefail

SERVICE_USER="argent-lite"
INSTALL_DIR="/opt/argent-lite"
STATE_DIR="/var/lib/argent-lite"
LOG_DIR="/var/log/argent-lite"
UNIT_PATH="/etc/systemd/system/argent-lite.service"
ENV_EXAMPLE_DST="/etc/default/argent-lite.example"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '[install] %s\n' "$*"; }
err() { printf '[install] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "must run as root"

command -v node >/dev/null 2>&1 || err "node not found on PATH"
command -v pnpm >/dev/null 2>&1 || err "pnpm not found on PATH"

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    log "creating system user $SERVICE_USER"
    useradd --system --home-dir "$STATE_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
else
    log "user $SERVICE_USER already exists"
fi

log "ensuring $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

log "ensuring $STATE_DIR and $LOG_DIR"
mkdir -p "$STATE_DIR" "$LOG_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$STATE_DIR" "$LOG_DIR"
chmod 0750 "$STATE_DIR" "$LOG_DIR"

log "syncing repo contents to $INSTALL_DIR (excluding node_modules, .git, dist)"
if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
        --exclude='.git/' \
        --exclude='node_modules/' \
        --exclude='dist/' \
        --exclude='ops/team/inbox/' \
        --exclude='ops/team/outbox/' \
        "$SRC_DIR"/ "$INSTALL_DIR"/
else
    err "rsync not found; please install rsync"
fi

log "installing production deps"
( cd "$INSTALL_DIR" && pnpm install --prod --frozen-lockfile )

log "building"
# Build needs dev deps; do a build-only install in a temp marker dir.
( cd "$INSTALL_DIR" && pnpm install --frozen-lockfile && pnpm build && pnpm prune --prod )

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

log "installing unit file to $UNIT_PATH"
install -m 0644 "$INSTALL_DIR/deploy/argent-lite.service" "$UNIT_PATH"

log "installing env example to $ENV_EXAMPLE_DST (never overwrites live env file)"
install -m 0644 "$INSTALL_DIR/deploy/env.example" "$ENV_EXAMPLE_DST"

log "reloading systemd"
systemctl daemon-reload

cat <<EOF

[install] done.

Next steps (operator):
  1. cp $ENV_EXAMPLE_DST /etc/default/argent-lite
     chown root:$SERVICE_USER /etc/default/argent-lite
     chmod 0640 /etc/default/argent-lite
  2. Edit /etc/default/argent-lite and set ARGENT_MASTER_KEY (openssl rand -base64 32).
  3. systemctl enable argent-lite.service
  4. systemctl start argent-lite.service
  5. journalctl -u argent-lite -f

EOF
