# Task 002 — engineer

Contract: ops/contracts/engineer.contract.md
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: ops-reality-alignment (slice expansion on ops-team-bootstrap)
Branch: codex/ops-team-bootstrap (stay on current branch)
Surface (WRITE authorized — do NOT touch anything else):
- ops/team/outbox/engineer.md
- ops/runbooks/dev-workflow.md
- ops/rules/branching.md
- scripts/send-pr-email.sh           (create as stub — see below)
- scripts/send-escalation-email.sh   (create as stub — see below)
- scripts/check-ci-health.sh         (create as stub — see below)

## Goal

Close the gaps your cycle-1 audit found. Your cycle-1 report is archived
at `ops/team/archive/cycle-001/engineer.md`. Re-read it first.

Do three concrete things:

### 1. Create the 3 missing scripts as **honest stubs**

Each stub must be a real executable bash file that:

- starts with `#!/usr/bin/env bash` and `set -euo pipefail`
- logs a structured line to stderr identifying the script, args, and
  the fact that it is a stub
- exits with code 0 for `check-ci-health.sh` and `send-pr-email.sh` and
  code 2 for `send-escalation-email.sh` (so escalation failures are loud)
- has a one-paragraph header comment explaining why it is a stub and
  what a full implementation would need
- references the runbook(s) that call it

`send-pr-email.sh` takes a PR number. `send-escalation-email.sh` takes
either an issue number or a message string. `check-ci-health.sh` accepts
an optional `--auto-issue` flag.

Do not actually send email or call GitHub. These are stubs. The runbooks
currently call them expecting real behavior, but for Pi-only headless
operation we need the calls to succeed locally without network side
effects.

### 2. Rewrite `ops/runbooks/dev-workflow.md` for Pi reality

Keep the file. Replace its Mac-station assumptions with a Pi-variant:

- remove references to `/home/jason/code/argent-lite-develop-clean` and
  `/home/jason/code/argent-lite-main-clean` unless those worktrees are
  created (they are not — your audit confirmed this)
- drop the two-station Automation Mac / Primary Mac model from this file
- the minimum validation block (`pnpm install` etc.) should be gated on
  `package.json` existing — add a preamble that says "if no package.json,
  this runbook is inapplicable; claim the project-floor slice first"
- keep the release-lane flow but simplify it for single-machine operation
  (codex → develop → main with operator sign-off, no clean-lane worktrees)

Do not rewrite bug-patrol.md or feature-patrol.md. Those need a separate
task and are not in your surface.

### 3. Update `ops/rules/branching.md`

Remove or mark as optional the `/home/jason/code/argent-lite-*-clean`
worktree references. Keep the branch naming rules as-is. Add a note
that clean-lane worktrees are optional for this Pi deploy and can be
created later if needed.

### Do NOT

- Create `package.json`, `src/`, or any runtime code. That is blocked
  on operator approval of the scope memo.
- Touch `bug-patrol.md`, `feature-patrol.md`, `incident-response.md`,
  `health-monitoring.md`, or `daily-digest.md`. Those are a separate
  slice.
- Touch the `argentos.ai` references in runbooks beyond what
  `dev-workflow.md` contains. That is a separate task.

## Acceptance criterion

- Three executable stub scripts exist at the paths above with shebang,
  set -euo pipefail, structured stub logging, and reference comments.
- `ops/runbooks/dev-workflow.md` and `ops/rules/branching.md` no longer
  hard-code the non-existent clean-lane worktrees as mandatory.
- `ops/team/outbox/engineer.md` lists every file touched with real
  commit SHAs and reports `pnpm build` as `NOT RUN (no package.json)`.
- No file outside the authorized surface is modified.

## Validation commands

- `bash -n scripts/send-pr-email.sh`           — syntax check, expect exit 0
- `bash -n scripts/send-escalation-email.sh`   — syntax check, expect exit 0
- `bash -n scripts/check-ci-health.sh`         — syntax check, expect exit 0
- `bash scripts/check-ci-health.sh`            — stub run, expect exit 0
- `bash scripts/send-pr-email.sh 999`          — stub run, expect exit 0
- `bash scripts/send-escalation-email.sh test` — stub run, expect exit 2

Report each command with its real exit code.

## Deadline

Before the next operator check-in.
