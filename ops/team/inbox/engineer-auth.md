# Task 014 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: ollama-smoke-retry
Branch: codex/ollama-smoke-retry (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- scripts/phase3-ollama-smoke.sh
- tests/integration/ollama-smoke.skip.md

## Context

`scripts/phase3-smoke.sh` uses a stub provider and passes. The real
ollama §4 smoke (against `localhost:11434`) was attempted earlier but
the Pi's load average hit 13 during the autonomous run and ollama
timed out. We want a real-ollama smoke script that can run later
(after load drops, or on a dedicated Pi), with explicit timeout and
pass/fail reporting.

## Goal

1. **`scripts/phase3-ollama-smoke.sh`** — bash, `set -euo pipefail`:
   - `curl -s -o /dev/null -w '%{http_code}' http://localhost:11434/api/tags`
     — if not 200, exit 77 (SKIP) with a clear message.
   - Check load average via `cat /proc/loadavg`; if the 1-min load is
     above 6.0, print a warning and exit 77 (SKIP with reason "pi overloaded").
   - Build dist if stale.
   - Run the bootRuntime + OllamaProvider invocation inline via `node -e`
     with `gemma3:1b`, input "what is 2+2 in one word".
   - Timeout 45 seconds via `timeout 45 node ...`.
   - After the run, query `memory.sqlite` via node:sqlite and assert:
     `channel.in >= 1`, `router.out >= 1`, `channel.out >= 1`.
   - Exit 0 on full pass, 1 on failure, 77 on skip. Log everything
     to `/tmp/ollama-smoke-$(date +%s).log`.
2. **`tests/integration/ollama-smoke.skip.md`** — one paragraph
   explaining why this script exists as a separate smoke, when to run
   it, and how to interpret exit code 77 (SKIP).

## Constraints

- Do NOT touch `scripts/phase3-smoke.sh` — that's the canonical CI stub smoke.
- Node built-ins only, no new deps.
- Pure script + docs. No src/** changes.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
