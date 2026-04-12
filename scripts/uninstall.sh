#!/usr/bin/env bash
# Argent Lite uninstaller. Idempotent. Run as root.
# Preserves /etc/default/argent-lite and $ARGENT_HOME (default /var/lib/argent-lite).
set -euo pipefail

SERVICE_USER="argent-lite"
INSTALL_DIR="/opt/argent-lite"
UNIT_PATH="/etc/systemd/system/argent-lite.service"
ENV_EXAMPLE_DST="/etc/default/argent-lite.example"

log() { printf '[uninstall] %s\n' "$*"; }
err() { printf '[uninstall] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "must run as root"

if systemctl list-unit-files | grep -q '^argent-lite\.service'; then
    log "stopping argent-lite.service (if running)"
    systemctl stop argent-lite.service 2>/dev/null || true
    log "disabling argent-lite.service"
    systemctl disable argent-lite.service 2>/dev/null || true
else
    log "argent-lite.service not registered; skipping stop/disable"
fi

if [[ -f "$UNIT_PATH" ]]; then
    log "removing $UNIT_PATH"
    rm -f "$UNIT_PATH"
    systemctl daemon-reload
fi

if [[ -f "$ENV_EXAMPLE_DST" ]]; then
    log "removing $ENV_EXAMPLE_DST"
    rm -f "$ENV_EXAMPLE_DST"
fi

if [[ -d "$INSTALL_DIR" ]]; then
    log "removing $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
fi

log "preserving /etc/default/argent-lite (operator config)"
log "preserving /var/lib/argent-lite (runtime state)"
log "preserving /var/log/argent-lite (logs)"
log "preserving system user $SERVICE_USER"

cat <<EOF

[uninstall] done.

Residual state kept on purpose:
  - /etc/default/argent-lite   (operator env file)
  - /var/lib/argent-lite       (ARGENT_HOME data)
  - /var/log/argent-lite       (logs)
  - user/group $SERVICE_USER

Remove manually if you want a full wipe.

EOF
