#!/usr/bin/env bash
# hailo-setup.sh — pure probe for the Raspberry Pi AI HAT+ 2 (Hailo-10H).
# Reports state only. Never installs, never modifies system state.
#
# Exit codes:
#   0  card present and hailortcli identifies it
#   2  recoverable gap (hailortcli not installed)
#   1  unexpected failure (CLI present but identify failed)

set -euo pipefail

LOG="/tmp/hailo-setup-$(date +%s).log"
exec > >(tee -a "$LOG") 2>&1

echo "=== hailo-setup probe ==="
echo "host:    $(hostname)"
echo "date:    $(date -Iseconds)"
echo "kernel:  $(uname -r)"
echo "log:     $LOG"
echo

echo "--- kernel module (lsmod | grep hailo) ---"
if lsmod_out=$(lsmod 2>/dev/null | grep -i hailo); then
  echo "$lsmod_out"
else
  echo "WARN: no hailo kernel module loaded"
fi
echo

echo "--- pci device (lspci | grep -i hailo) ---"
if command -v lspci >/dev/null 2>&1; then
  if lspci_out=$(lspci -nn 2>/dev/null | grep -i hailo); then
    echo "$lspci_out"
  else
    echo "WARN: no Hailo PCIe device found"
  fi
else
  echo "WARN: lspci not installed"
fi
echo

echo "--- hailortcli presence ---"
if ! command -v hailortcli >/dev/null 2>&1; then
  cat <<'EOF'
MISSING: hailortcli not on PATH.
Install (Debian 12, Pi 5):
  sudo apt update
  sudo apt install -y hailo-all
  sudo reboot
See docs/hailo-setup.md for the full procedure.
EOF
  echo
  echo "RESULT: gap (hailortcli missing)"
  exit 2
fi
echo "OK: $(command -v hailortcli)"
echo

echo "--- hailortcli fw-control identify ---"
if identify_out=$(hailortcli fw-control identify 2>&1); then
  echo "$identify_out"
  echo
  echo "RESULT: ok"
  exit 0
fi
echo "$identify_out"
echo
echo "RESULT: identify failed"
exit 1
