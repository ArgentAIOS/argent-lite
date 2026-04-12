#!/usr/bin/env bash
# hailo-check.sh — thin smoke test. Exit 0 iff a Hailo-10H is present
# and hailortcli can identify it. Meant for CI and nightly smoke.

set -euo pipefail

if ! command -v hailortcli >/dev/null 2>&1; then
  echo "hailo-check: hailortcli not installed" >&2
  exit 1
fi

if ! out=$(hailortcli fw-control identify 2>&1); then
  echo "hailo-check: identify failed" >&2
  echo "$out" >&2
  exit 1
fi

if ! printf '%s\n' "$out" | grep -qiE 'hailo[-_ ]?10|hailo10h'; then
  echo "hailo-check: identify ran but no Hailo-10H reported" >&2
  echo "$out" >&2
  exit 1
fi

echo "hailo-check: ok"
exit 0
