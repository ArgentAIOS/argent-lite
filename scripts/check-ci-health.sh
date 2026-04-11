#!/usr/bin/env bash
set -euo pipefail

# STUB: This script is a placeholder for the real CI health checker.
# A full implementation would query GitHub Actions (via gh api) for recent
# workflow runs, detect failures or stuck jobs, and optionally create a
# GitHub issue if --auto-issue is passed. Referenced by:
# ops/runbooks/bug-patrol.md, ops/runbooks/feature-patrol.md.

AUTO_ISSUE=false
for arg in "$@"; do
  case "$arg" in
    --auto-issue) AUTO_ISSUE=true ;;
    *) echo >&2 "[STUB] check-ci-health.sh: unknown argument '${arg}'" ;;
  esac
done

echo >&2 "[STUB] check-ci-health.sh: called (auto-issue=${AUTO_ISSUE}) — no CI check performed (stub mode)"
exit 0
