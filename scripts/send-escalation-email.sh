#!/usr/bin/env bash
set -euo pipefail

# STUB: This script is a placeholder for the real escalation email sender.
# A full implementation would send an urgent email to the operator with the
# issue details or escalation message, suitable for feature requests that
# require human approval or incidents needing immediate attention. Referenced
# by: ops/runbooks/bug-patrol.md, ops/runbooks/feature-patrol.md,
# ops/runbooks/incident-response.md, ops/rules/never-do.md.

ARG="${1:?Usage: send-escalation-email.sh <issue-number|message>}"

echo >&2 "[STUB] send-escalation-email.sh: called with '${ARG}' — no email sent (stub mode, exiting 2)"
exit 2
