# Runbook: Daily Digest

> Morning summary of overnight activity, deployments, and open work. Run at the start of each day or after a long patrol gap.

## When to Run

- Start of each working day
- After a long gap (>6 hours without a patrol cycle)
- On request from the operator

## What to Report

### 1. Site Health Snapshot
```bash
curl -s -o /dev/null -w "status:%{http_code} time:%{time_total}s" https://argentos.ai
```

### 2. Overnight Issues
```bash
gh issue list --repo ArgentAIOS/argent-lite --state all --json number,title,state,createdAt,closedAt --limit 20
```

### 3. PR Activity
```bash
# Open PRs
gh pr list --repo ArgentAIOS/argent-lite --state open

# Recently merged PRs
gh pr list --repo ArgentAIOS/argent-lite --state merged --limit 5
```

### 4. Recent Deploys
```bash
git log main --since="24 hours ago" --oneline
```

### 5. Open Work Items
- `ops/slices/REGISTRY.md` — any claimed but incomplete slices?
- `ops/projects/ACTIVE.md` — current project status
- Open PRs waiting for review

## Digest Format

```
Daily Digest — [date]

SITE: [status code] ([response time])
ISSUES: [X opened, Y closed in last 24h]
PRs: [X open, Y merged in last 24h]
DEPLOYS: [last commit hash + message]
OPEN WORK: [any stale slices or blocked PRs]
ALERTS: [anything unusual]
```

## Automation

To run a daily digest automatically:

```
/loop 24h Daily Digest: Run ops/runbooks/daily-digest.md checks and report summary.
```
