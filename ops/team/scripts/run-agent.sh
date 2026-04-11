#!/usr/bin/env bash
# Run one teammate agent: reads its inbox, writes its outbox.
# Usage: bash ops/team/scripts/run-agent.sh <architect|engineer|reviewer>
set -euo pipefail

ROLE="${1:?role required}"
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

INBOX="ops/team/inbox/${ROLE}.md"
OUTBOX="ops/team/outbox/${ROLE}.md"
CONTRACT="ops/contracts/${ROLE}.contract.md"

if [[ ! -f "$INBOX" ]]; then
  echo "[$(date -Is)] no inbox for $ROLE, exiting"
  exit 0
fi
if [[ ! -f "$CONTRACT" ]]; then
  echo "[$(date -Is)] missing contract $CONTRACT — stopping"
  exit 1
fi

PROMPT=$(cat <<EOF
You are the Argent Lite ops-team ${ROLE}. You are running in a tmux pane
that the operator is watching. You have exactly one task, defined below.

Mandatory before your first action:
1. Read ops/CLAUDE.md
2. Read ops/contracts/team-onboarding.contract.md
3. Read ops/contracts/${ROLE}.contract.md
4. Read ops/rules/never-do.md and ops/rules/branching.md
5. Read every runbook named in the inbox task
6. Read ops/slices/REGISTRY.md and ops/projects/ACTIVE.md

Your inbox task is in ${INBOX}. Read it now.

When you have read everything, your first action must be to write your
confirmation line to ${OUTBOX} (overwrite it), exactly this format:

    I have read ops/ and am operating under contract:
    ${CONTRACT}.

Then do the task. When done, overwrite ${OUTBOX} with the full output
shape defined in your role contract. Do not edit any file outside
${OUTBOX} unless your inbox task explicitly authorizes it.

If any precondition is false or any cited file is missing, overwrite
${OUTBOX} with a single line:

    BLOCKED: <reason>

and stop. Do not fabricate references. Do not argue with the inbox.
EOF
)

echo "[$(date -Is)] ${ROLE} starting, contract=${CONTRACT}"
echo "--- inbox ---"
cat "$INBOX"
echo "--- launching claude ---"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  2>&1 | tee -a "ops/team/logs/${ROLE}.log"
echo "[$(date -Is)] ${ROLE} finished, outbox:"
echo "--- outbox ---"
cat "$OUTBOX" 2>/dev/null || echo "(outbox not written)"
