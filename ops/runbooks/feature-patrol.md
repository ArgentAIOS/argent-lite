# Runbook: Feature Patrol (Primary Mac)

> **This station builds features and monitors for approved work.** Runs on the Primary Mac. Separate from Bug Patrol which runs on the Automation Mac.

## Which Mac Runs What

| Station | Mac | Session | Role | Auto-Fixes Bugs? | Builds Features? |
|---------|-----|---------|------|-------------------|------------------|
| **Bug Patrol** | Automation Mac | `patrol` | Monitor + auto-fix | Yes | No |
| **Feature Patrol** | Primary Mac | `dev` | Feature dev + monitoring | No | Yes |

## How to Enable

Start the feature patrol loop:

```
/loop 30m Feature Patrol: Check gh issue list --repo ArgentAIOS/argent-lite --state open for new issues. Classify as BUG or FEATURE REQUEST. Fix bugs on branch, create PR, wait for CI + review, then send PR email. Escalate feature requests. Check site health: curl https://argentos.ai. Follow ops/runbooks/feature-patrol.md and ops/runbooks/pr-workflow.md.
```

## What Feature Patrol Does

Every cycle follows a **sync → review → act** sequence:

### Phase 0: Sync and Review (MANDATORY)

**Follow `ops/runbooks/loop-contract.md`** — pull latest, re-read this runbook + never-do.md + pr-workflow.md, check ops state. Never run on stale instructions.

### Phase 1: Health Checks

1. **Site health**: `curl -s -o /dev/null -w "%{http_code}" https://argentos.ai` — alert if non-200
2. **CI health**: `bash scripts/check-ci-health.sh --auto-issue` — if CI is red on `main`, auto-creates a GitHub issue

### Phase 2: Issue Triage

3. **Check issues**: `gh issue list --repo ArgentAIOS/argent-lite --state open`
4. **Classify** each issue as BUG or FEATURE REQUEST (CI failure issues are bugs)
5. **For bugs**: Create branch, fix, PR, wait for CI + review, send PR email (same as Bug Patrol)
6. **For feature requests**: Escalate with `bash scripts/send-escalation-email.sh <issue-number>`
7. **For approved features**: Pick up and build (this is what distinguishes Feature Patrol)

## Feature Pickup Workflow

When the operator approves a feature request:

1. **Claim it on GitHub**: Comment on the issue:
   `✅ **Approved by [name].** Feature Patrol (Primary Mac) is now building this feature. Branch and PR incoming.`
2. **Create a feature branch**: `feat/issue-{number}-short-description`
3. **Build it** following ops workflows (REGISTRY, ACTIVE, project rules)
4. **Update changelog** with version bump
5. **Create PR**: `gh pr create` with detailed description
6. **Wait for quality gates**: CI → Code review → all green
7. **Send PR email**: `bash scripts/send-pr-email.sh {pr-number}`
8. **Close the issue** with detailed resolution comment after merge

## How Feature Patrol Differs from Bug Patrol

| Aspect | Bug Patrol (Automation Mac) | Feature Patrol (Primary Mac) |
|--------|--------------------------------------|---------------------------------------|
| **Primary job** | Auto-fix bugs | Build approved features |
| **Bug handling** | Fixes autonomously | Fixes if found during patrol |
| **Feature requests** | Escalates only, never builds | Builds after operator approval |
| **Complexity** | Small, targeted fixes | Large features, multi-file |
| **Changelog** | Patch bumps (0.0.X) | Minor/major bumps (0.X.0) |

## Overlap Handling

Both stations may find the same issue. Rules to prevent conflicts:

1. **Check assignees first**: If an issue is already assigned or has a "taken" comment, skip it
2. **Bug Patrol gets priority on bugs**: If both stations see a bug, Bug Patrol owns it
3. **Feature Patrol gets priority on features**: If both stations see an approved feature, Feature Patrol owns it
4. **Claim before you build**: Always comment on the issue before starting work
5. **Check for active branches**: `git branch -r | grep issue-{number}` — if a branch exists, someone is already on it

## Quality Gates (Same as Bug Patrol)

All PRs follow the same gates regardless of which station creates them:

```
Create branch → Build → Create PR → CI → Code review → Fix issues → All green → Send PR email → Review → Merge → Deploy
```

See `ops/runbooks/pr-workflow.md` for the full gate-by-gate process.

## Quick Reference

```bash
# Start feature patrol
/loop 30m Feature Patrol: Check gh issue list...

# Check open issues
gh issue list --repo ArgentAIOS/argent-lite --state open

# Claim a feature
gh issue comment <number> --repo ArgentAIOS/argent-lite --body "✅ Feature Patrol (Primary Mac) taking this."

# Send feature escalation
bash scripts/send-escalation-email.sh <issue-number>

# Send PR notification
bash scripts/send-pr-email.sh <pr-number>

# Health check
curl -s -o /dev/null -w "%{http_code}" https://argentos.ai
```
