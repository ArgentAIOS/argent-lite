#!/usr/bin/env bash
set -euo pipefail

# STUB: This script is a placeholder for the real PR notification email sender.
# A full implementation would use an SMTP relay or API (e.g., SendGrid, SES) to
# send a formatted email to the operator with the PR URL, diff summary, and CI
# status. Referenced by: ops/runbooks/pr-workflow.md, ops/runbooks/bug-patrol.md,
# ops/runbooks/feature-patrol.md.

PR_NUMBER="${1:?Usage: send-pr-email.sh <pr-number>}"

echo >&2 "[STUB] send-pr-email.sh: called with PR #${PR_NUMBER} — no email sent (stub mode)"
exit 0
