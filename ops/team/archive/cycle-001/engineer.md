I have read ops/ and am operating under contract:
ops/contracts/engineer.contract.md.

## Task 001 — Gap Report: Runbook Claims vs. Repo Reality

### Scripts Referenced in Runbooks

| Script | Referenced In | Status | Path |
| --- | --- | --- | --- |
| `scripts/send-pr-email.sh` | pr-workflow.md, bug-patrol.md, feature-patrol.md | **MISSING** | `/home/jason/code/argent-lite/scripts/send-pr-email.sh` — does not exist |
| `scripts/send-escalation-email.sh` | bug-patrol.md, feature-patrol.md, incident-response.md, never-do.md | **MISSING** | `/home/jason/code/argent-lite/scripts/send-escalation-email.sh` — does not exist |
| `scripts/check-ci-health.sh` | bug-patrol.md, feature-patrol.md | **MISSING** | `/home/jason/code/argent-lite/scripts/check-ci-health.sh` — does not exist |
| `scripts/check-handoff.mjs` | (ops tooling) | **PRESENT** | `/home/jason/code/argent-lite/scripts/check-handoff.mjs` |
| `scripts/check-pr-intake.mjs` | (ops tooling) | **PRESENT** | `/home/jason/code/argent-lite/scripts/check-pr-intake.mjs` |

Note: All three missing scripts are already called out in `ops/CLAUDE.md` under "Script inventory" as referenced-but-missing. Every runbook that depends on them is blocked for those steps.

### Worktree Paths Referenced in Runbooks

| Path | Referenced In | Status | Note |
| --- | --- | --- | --- |
| `/home/jason/code/argent-lite` | dev-workflow.md, branching.md | **PRESENT** | Primary dev workspace exists |
| `/home/jason/code/argent-lite-develop-clean` | dev-workflow.md, branching.md | **MISSING** | Clean integration worktree does not exist on this Pi |
| `/home/jason/code/argent-lite-main-clean` | dev-workflow.md, branching.md | **MISSING** | Clean trunk worktree does not exist on this Pi |

Note: `ops/CLAUDE.md` already flags this as a known issue ("Mac-station mismatch"). The two-station model (Automation Mac / Primary Mac) in bug-patrol.md and feature-patrol.md does not map to this single-Pi deployment.

### pnpm Commands from dev-workflow.md

| Command | Status | Reason |
| --- | --- | --- |
| `pnpm install` | **MISSING prerequisite** | No `package.json` at `/home/jason/code/argent-lite/package.json` — would fail with "no package.json found" |
| `pnpm build` | **MISSING prerequisite** | Same — no `package.json` |
| `pnpm check` | **MISSING prerequisite** | Same — no `package.json` |
| `pnpm test` | **MISSING prerequisite** | Same — no `package.json` |
| `pnpm protocol:check` | **MISSING prerequisite** | Same — no `package.json` |
| `pnpm --dir dashboard build` | **MISSING prerequisite** | No `dashboard/` directory at `/home/jason/code/argent-lite/dashboard/` and no `package.json` |

Note: None of these commands can run today. This is expected per `ops/CLAUDE.md` ("zero application code in this repo today") and per the engineer contract's standing guidance ("no `package.json` yet, so `pnpm build` will fail").

### `https://argentos.ai` References

| File | Context | Status |
| --- | --- | --- |
| `ops/runbooks/pr-workflow.md` | Site health check via `curl` | **AMBIGUOUS** — unclear if this is the Lite deployment target or inherited from argentos-core |
| `ops/runbooks/bug-patrol.md` | Site health check + incident detection | **AMBIGUOUS** — same |
| `ops/runbooks/feature-patrol.md` | Site health check | **AMBIGUOUS** — same |
| `ops/runbooks/incident-response.md` | Outage detection and recovery | **AMBIGUOUS** — same |
| `ops/runbooks/health-monitoring.md` | Health monitoring | **AMBIGUOUS** — same |
| `ops/runbooks/threadmaster-handoff.md` | Referenced in handoff context | **AMBIGUOUS** — same |
| `ops/runbooks/daily-digest.md` | Referenced in digest context | **AMBIGUOUS** — same |

Note: 8 files across ops/ reference `argentos.ai`. The Argent Lite repo has no deployment configuration pointing to this domain. The domain and all health-check URLs appear inherited from the argentos-core runbooks. If Argent Lite has its own deployment target, the runbooks need updating. If it shares `argentos.ai`, that should be documented explicitly.

### Directory / File Existence

| Item | Status | Path |
| --- | --- | --- |
| `package.json` | **MISSING** | `/home/jason/code/argent-lite/package.json` |
| `src/` | **MISSING** | `/home/jason/code/argent-lite/src/` |
| `dashboard/` | **MISSING** | `/home/jason/code/argent-lite/dashboard/` |

Note: All three are expected missing per `ops/CLAUDE.md` — "Do not invent `package.json`, `src/`, or runtime code until a scope decision exists."

### Two-Station Model Mismatch

The runbooks `bug-patrol.md` and `feature-patrol.md` define a two-Mac model:

| Station | Expected Host | Actual Host | Status |
| --- | --- | --- | --- |
| Bug Patrol | Automation Mac, session `patrol` | Pi 5 `pi5miniAI` | **AMBIGUOUS** — model does not map to single Pi |
| Feature Patrol | Primary Mac, session `dev` | Pi 5 `pi5miniAI` | **AMBIGUOUS** — model does not map to single Pi |

---

## Summary

- **3 scripts MISSING**: `send-pr-email.sh`, `send-escalation-email.sh`, `check-ci-health.sh` — blocks PR workflow gates 3+, all escalation paths, and CI health checks
- **2 worktrees MISSING**: `develop-clean` and `main-clean` — blocks the clean-lane validation and release flow
- **6 pnpm commands non-functional**: no `package.json` — blocks all build/test validation (expected, no app code yet)
- **7+ files reference `argentos.ai`**: ambiguous whether this is the Lite target or inherited from argentos-core
- **Two-station Mac model**: does not map to single-Pi deployment

## Files Touched

- `ops/team/outbox/engineer.md` (this file)

## Commits Made

None (read-only audit task).

## Validation Results

n/a (audit task, no validation commands specified).

## Blockers / Follow-ups for Team Lead

1. The three missing scripts should be created or the runbooks rewritten to remove those steps before any patrol workflow can run.
2. The clean-lane worktrees need to be created on the Pi or the dev-workflow/branching rules need a Pi-specific variant.
3. The `argentos.ai` domain references need a decision: is Argent Lite deployed there, or does it get its own domain/URL?
4. The two-station Mac model in bug-patrol.md and feature-patrol.md needs adaptation for single-Pi operation.

## Contract Reference

ops/contracts/engineer.contract.md
