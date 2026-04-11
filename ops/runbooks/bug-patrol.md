# Runbook: Bug Patrol (Automation Mac)

> **This station is BUG-ONLY.** Runs on the Automation Mac. Monitors GitHub Issues, auto-fixes bugs, and escalates feature requests to the operator who hands them off to Feature Patrol on the Primary Mac.
>
> **See also:** `ops/runbooks/feature-patrol.md` — the Primary Mac's feature development loop.

## Two Stations, Two Roles

| Station | Mac | Session | Role |
|---------|-----|---------|------|
| **Bug Patrol** (this runbook) | Automation Mac | `patrol` | Auto-fix bugs, escalate features |
| **Feature Patrol** | Primary Mac | `dev` | Build approved features, monitor |

Bug Patrol never builds features. Feature Patrol never auto-fixes bugs without an issue. Both share the same quality gates (`ops/runbooks/pr-workflow.md`).

## How to Enable

Start the bug patrol loop:

```
/loop 30m Bug Patrol: Check gh issue list --repo ArgentAIOS/argent-lite --state open for new issues. Classify as BUG or FEATURE REQUEST. Fix bugs on branch, create PR, wait for CI + review, then send PR email. Escalate feature requests. Check site health: curl https://argentos.ai. Follow ops/runbooks/bug-patrol.md and ops/runbooks/pr-workflow.md.
```

## What Bug Patrol Does

Every cycle follows a **sync → review → act** sequence:

### Phase 0: Sync and Review (MANDATORY)

**Follow `ops/runbooks/loop-contract.md`** — pull latest, re-read this runbook + never-do.md + pr-workflow.md, check ops state. Never run on stale instructions.

### Phase 1: Health Checks

1. **Site health**: `curl -s -o /dev/null -w "%{http_code}" https://argentos.ai` — alert if non-200
2. **CI health**: `bash scripts/check-ci-health.sh --auto-issue` — if CI is red on `main`, auto-creates a GitHub issue

### Phase 2: Issue Triage

3. **Check issues**: `gh issue list --repo ArgentAIOS/argent-lite --state open`
4. **Classify** each issue as BUG or FEATURE REQUEST (CI failure issues are bugs)
5. **For bugs** (including CI failures): Follow the Bug Fix Workflow below
6. **For feature requests**: Escalate — do NOT auto-implement

## Classification Rules

A **bug** is:
- Something that was working and broke (regression)
- Something that doesn't work as designed
- A crash, error, or data issue
- A security vulnerability
- A usability issue that prevents normal operation

A **feature request** is:
- "Can we add..."
- "I'd like to see..."
- "It would be nice if..."
- A new capability that doesn't exist yet
- A redesign or workflow change

### Gray Areas

- If it's blocking the user from completing a workflow → treat as bug, fix it
- If it's a "nice to have" or cosmetic → escalate as feature request
- When in doubt, ask — don't build

## Escalation Rules — Feature Requests

**CRITICAL: Only bugs get auto-fixed. Feature requests require operator approval.**

When a feature request is found:

1. **Do NOT auto-implement** — this station handles bugs only
2. Comment on the GitHub issue: "This appears to be a feature request, not a bug. Escalating for approval."
3. **Send escalation email**: `bash scripts/send-escalation-email.sh <issue-number>`
4. **Stop here.** The operator reviews and, if approved, hands to Feature Patrol.

### Feature Handoff Awareness

When scanning open issues, **skip issues that have been claimed by the feature agent.** Look for:
- A comment indicating another agent/developer is taking over
- Tags or labels indicating the issue is assigned to feature development
- Any comment from the operator approving and assigning the work

## Bug Fix Workflow (Batched Per Cycle)

**CRITICAL: All bugs found in a single patrol cycle are fixed on ONE branch, in ONE PR, with ONE merge.** This prevents deploy spam — each merge triggers a deploy, so batching keeps it to one deploy per cycle.

### Phase 1: Fix All Bugs (commit but do NOT create PR yet)

1. **Create one branch for the cycle**: `git checkout -b auto/bugfix-batch-YYYY-MM-DD`
2. **For each open bug** (in priority order: CRITICAL → HIGH → MEDIUM → LOW):
   a. **Identify**: `gh issue view <number> --repo ArgentAIOS/argent-lite`
   b. **Scout**: Investigate root cause
   c. **Fix**: Minimal change, follow project rules
   d. **Commit** the fix (reference the issue): `fix(GH #N): description`
   e. **Move to next bug** — do NOT create a PR yet
3. **After all bugs are fixed on the branch**: `pnpm build` must pass with all fixes together

### Phase 2: One PR for the Batch

4. **Create ONE PR** covering all fixes:
   ```bash
   gh pr create --repo ArgentAIOS/argent-lite \
     --title "fix: Batch bug fixes — GH #X, #Y, #Z" \
     --body "Fixes #X, #Y, #Z in a single batch."
   ```
5. **Wait for CI**: `gh pr checks {pr-number} --repo ArgentAIOS/argent-lite --watch` — if fails, fix and push
6. **Wait for code review**: Check for review comments — if suggestions, fix, push, comment on PR with what you changed (audit trail)
7. **Send PR email**: `bash scripts/send-pr-email.sh {pr-number}` — ONLY after CI green + review clear

### Phase 3: Merge and Close

8. **MERGE PR (MANDATORY)**: `gh pr merge {pr-number} --repo ArgentAIOS/argent-lite --merge --delete-branch` — **CI green + review clear + email sent = MERGE NOW. An unmerged green PR is an incomplete task.**
9. **Close ALL GitHub Issues** in the batch with detailed resolution comments
10. **Update Changelog**: Add all fixes to changelog

### Single Bug Exception

If there's only one bug in the cycle, the workflow is the same — one branch, one PR, one merge.

## Loop Behavior

- Runs every 30 minutes while the session is active
- Each cycle is independent — if no new issues, report "No new issues"
- **All bugs in a cycle are batched into ONE PR** — never create multiple PRs per cycle

## Quick Reference

```bash
# Check open issues
gh issue list --repo ArgentAIOS/argent-lite --state open

# Close a GitHub issue
gh issue close <number> --repo ArgentAIOS/argent-lite --comment "Fixed: ..."

# Send feature request escalation email
bash scripts/send-escalation-email.sh <issue-number>

# Health check
curl -s -o /dev/null -w "%{http_code}" https://argentos.ai
```
