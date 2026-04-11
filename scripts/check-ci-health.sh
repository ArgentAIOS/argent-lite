#!/usr/bin/env bash
set -euo pipefail

# check-ci-health.sh — compact CI status table for the 5 most recent runs.
# Queries GitHub Actions via `gh run list` and prints one line per run with
# a status emoji. `--auto-issue` is accepted but still a stub.
# Referenced by: ops/runbooks/bug-patrol.md, ops/runbooks/feature-patrol.md.

AUTO_ISSUE=false
for arg in "$@"; do
  case "$arg" in
    --auto-issue) AUTO_ISSUE=true ;;
    -h|--help)
      cat <<'USAGE'
Usage: check-ci-health.sh [--auto-issue]

Prints the 5 most recent GitHub Actions runs for the current repo as a
compact table. --auto-issue is reserved for future use and currently a
no-op.
USAGE
      exit 0
      ;;
    *) echo >&2 "check-ci-health.sh: unknown argument '${arg}'"; exit 2 ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo >&2 "check-ci-health.sh: gh CLI not found"
  exit 1
fi

rows="$(gh run list --limit 5 \
  --json status,conclusion,name \
  --template '{{range .}}{{.status}}|{{.conclusion}}|{{.name}}{{"\n"}}{{end}}' \
  2>/dev/null || true)"

if [[ -z "${rows}" ]]; then
  echo "no runs"
  exit 0
fi

printf '%-3s  %-12s  %-12s  %s\n' "" "STATUS" "CONCLUSION" "NAME"
while IFS='|' read -r status conclusion name; do
  [[ -z "${status}" && -z "${conclusion}" && -z "${name}" ]] && continue
  case "${conclusion}" in
    success)   emoji="✅" ;;
    failure)   emoji="❌" ;;
    cancelled) emoji="⚪" ;;
    skipped)   emoji="⏭" ;;
    "")        emoji="⏳" ;;
    *)         emoji="❔" ;;
  esac
  if [[ "${status}" == "in_progress" || "${status}" == "queued" ]]; then
    emoji="⏳"
  fi
  printf '%-3s  %-12s  %-12s  %s\n' "${emoji}" "${status}" "${conclusion:-—}" "${name}"
done <<< "${rows}"

if ${AUTO_ISSUE}; then
  echo >&2 "check-ci-health.sh: --auto-issue is a stub (no issue filed)"
fi

exit 0
