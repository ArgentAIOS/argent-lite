# Runbook: Ops Sync

> Keep all operational state in sync. Run before every push, at session start/end, and after completing work.

## When to Sync

- Before every push to remote
- At the start and end of each session
- After completing a slice of work
- Before handing off to another agent

## Sync Checklist

### 1. Slice Registry
**File:** `ops/slices/REGISTRY.md`

- Update slice status: `in-progress` → `deployed` → `completed`
- Clear stale slices that are no longer active
- Verify your slice branch matches what you're actually working on

### 2. Active Projects
**File:** `ops/projects/ACTIVE.md`

- Update project status: `planned` → `in-progress` → `mostly complete` → `complete`
- Add notes about blockers or dependencies

### 3. Journal
**File:** `ops/log/JOURNAL.md`

Write an entry (newest first) with:
- Date and time
- Slice name and branch
- What was done
- What's next
- Any issues or blockers

### 4. Changelog
If changes are significant, update the changelog per `ops/runbooks/changelog.md`.

### 5. Issue Tracker
- Update issue status (Done / In Progress / Backlog)
- Close resolved issues with comments
- Link PRs to issues

### 6. GitHub Issues
```bash
gh issue list --repo ArgentAIOS/argent-lite --state open
```
Close any issues that were resolved by your work.

## Quick Checklist

```
[ ] REGISTRY.md — slice status current
[ ] ACTIVE.md — project status current
[ ] JOURNAL.md — session entry written
[ ] Changelog — version bumped if significant
[ ] Issue tracker — statuses updated
[ ] GitHub issues — resolved issues closed
```

## Conflict Avoidance (Multi-Mac)

When running multiple stations (Bug Patrol + Feature Patrol):
- Bug Patrol updates: bug-related slices, bug issue closures
- Feature Patrol updates: feature slices, feature issue closures, major version bumps
- Both can write journal entries (they won't conflict if timestamped)
