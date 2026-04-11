#!/usr/bin/env bash
# Run one teammate agent: reads its inbox, writes its outbox.
# Usage: bash ops/team/scripts/run-agent.sh <role> [worktree_path]
#
# Examples:
#   bash ops/team/scripts/run-agent.sh architect
#   bash ops/team/scripts/run-agent.sh engineer-floor /home/jason/code/argent-lite-floor
#
# When a worktree path is given, the agent runs with that path as its
# working directory and reads its inbox/outbox from there. This lets
# multiple agents run in parallel without stepping on each other.
set -euo pipefail

ROLE="${1:?role required}"
WORKTREE="${2:-}"

if [[ -n "$WORKTREE" ]]; then
  cd "$WORKTREE"
else
  REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
  cd "$REPO_ROOT"
fi

INBOX="ops/team/inbox/${ROLE}.md"
OUTBOX="ops/team/outbox/${ROLE}.md"
CONTRACT="ops/contracts/${ROLE}.contract.md"
LOGDIR="ops/team/logs"
mkdir -p "$LOGDIR"

if [[ ! -f "$INBOX" ]]; then
  echo "[$(date -Is)] no inbox for $ROLE at $INBOX, exiting"
  exit 0
fi
if [[ ! -f "$CONTRACT" ]]; then
  echo "[$(date -Is)] missing contract $CONTRACT — stopping"
  exit 1
fi

PROMPT=$(cat <<EOF
You are the Argent Lite ops-team ${ROLE}. You are running in a tmux pane
that the operator is watching. You have exactly one task, defined in
${INBOX}, running inside the worktree $(pwd).

Mandatory before your first action:
1. Read ops/CLAUDE.md
2. Read ops/contracts/team-onboarding.contract.md
3. Read ops/contracts/${ROLE}.contract.md (may be a symlink to engineer.contract.md)
4. Read ops/rules/never-do.md and ops/rules/branching.md
5. Read every runbook named in the inbox task
6. Read ops/slices/REGISTRY.md and ops/projects/ACTIVE.md
7. Read your inbox at ${INBOX}

Branch and isolation:
- You are in git worktree \$(pwd). Branch: \$(git rev-parse --abbrev-ref HEAD).
- Commit every file you create on this branch with a descriptive
  message that mentions the slice name from your inbox.
- Do NOT git push. Do NOT merge. Do NOT touch branches other than this one.
- Do NOT edit files outside the surface named in your inbox.

When you have finished (or are BLOCKED), OVERWRITE ${OUTBOX} with the
output shape defined in your role contract. Start with the line:

    I have read ops/ and am operating under contract:
    ${CONTRACT}.

Then write the standard role output (files touched, commits, validation
results, blockers). Be concrete and truthful about exit codes.

If any precondition is false or any cited file is missing, overwrite
${OUTBOX} with a single line:

    BLOCKED: <reason>

and stop. Do not fabricate references. Do not argue with the inbox.
When you are truly done, exit — the tmux pane will show your final
output and return to a shell prompt.
EOF
)

echo "[$(date -Is)] ${ROLE} starting in $(pwd), branch=$(git rev-parse --abbrev-ref HEAD), contract=${CONTRACT}"
echo "--- inbox ---"
cat "$INBOX"
echo "--- launching claude ---"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  2>&1 | tee -a "${LOGDIR}/${ROLE}.log"
echo "[$(date -Is)] ${ROLE} finished, outbox:"
echo "--- outbox ---"
cat "$OUTBOX" 2>/dev/null || echo "(outbox not written)"
