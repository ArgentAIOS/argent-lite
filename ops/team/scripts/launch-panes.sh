#!/usr/bin/env bash
# Launch 5 teammate agents into 5 tmux panes in session `agent-lite`.
# Each pane is respawned as a fresh bash, cd'd to its worktree, running
# run-agent.sh. Operator pane %0 is left alone.
#
# Pane mapping:
#   %1 -> architect       /home/jason/code/argent-lite-cli
#   %2 -> engineer-floor  /home/jason/code/argent-lite-floor
#   %3 -> engineer-auth   /home/jason/code/argent-lite-auth
#   %4 -> engineer-router /home/jason/code/argent-lite-router
#   %5 -> reviewer        /home/jason/code/argent-lite-review
set -euo pipefail

SESSION="agent-lite"
REPO_MAIN="/home/jason/code/argent-lite"

dispatch() {
  local pane="$1" role="$2" worktree="$3"
  tmux respawn-pane -k -t "${SESSION}:1.${pane}" "bash -l" 2>/dev/null || true
  tmux select-pane -t "${SESSION}:1.${pane}" -T "${role}"
  tmux send-keys -t "${SESSION}:1.${pane}" "cd ${worktree} && bash ${REPO_MAIN}/ops/team/scripts/run-agent.sh ${role} ${worktree}" C-m
}

dispatch 3 architect       /home/jason/code/argent-lite-cli
dispatch 4 engineer-floor  /home/jason/code/argent-lite-floor
dispatch 5 engineer-auth   /home/jason/code/argent-lite-auth
dispatch 6 engineer-router /home/jason/code/argent-lite-router

# Reviewer runs in a loop — wrap the command
REVIEWER_CMD="cd /home/jason/code/argent-lite-review && while true; do bash ${REPO_MAIN}/ops/team/scripts/run-agent.sh reviewer /home/jason/code/argent-lite-review; echo '[reviewer] sleeping 120s'; sleep 120; done"
tmux respawn-pane -k -t "${SESSION}:1.2" "bash -l" 2>/dev/null || true
tmux select-pane -t "${SESSION}:1.2" -T "reviewer"
tmux send-keys -t "${SESSION}:1.2" "${REVIEWER_CMD}" C-m

echo "launched 5 agents into panes 2..6"
