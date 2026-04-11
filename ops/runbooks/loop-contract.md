# Runbook: Loop Contract (All Automated Loops)

> **Every automated loop MUST follow this contract.** This applies to Bug Patrol, Feature Patrol, Daily Digest, and any future loop added to the system.

## Phase 0: Sync and Review (MANDATORY — every cycle)

Before doing ANY work, every loop cycle must:

1. **Pull latest**: `git pull origin main` — get changes from other machines, agents, or manual commits
2. **Re-read your runbook**: Read your own runbook file from disk — rules may have changed since last cycle
3. **Re-read shared rules**: Read `ops/rules/never-do.md` and `ops/runbooks/pr-workflow.md`
4. **Check ops state**: Read `ops/slices/REGISTRY.md` and `ops/projects/ACTIVE.md` — know what's in progress before touching anything

**If the rules changed, follow the NEW rules immediately.** Never run on stale instructions. The ops files on disk are the source of truth, not your memory of what they said last cycle.

### Why This Matters

- Another machine may have updated runbooks
- The operator may have manually edited ops rules between cycles
- A previous cycle may have left ops state that affects this cycle
- Without sync, multiple machines can drift apart and break each other's work

## After Phase 0

Once sync is complete, proceed with your loop-specific workflow:
- **Bug Patrol**: `ops/runbooks/bug-patrol.md` Phase 1+
- **Feature Patrol**: `ops/runbooks/feature-patrol.md` Phase 1+
- **Daily Digest**: `ops/runbooks/daily-digest.md`
- **Any future loop**: Define phases after Phase 0 in your own runbook

## Loop Registration

All active loops should be documented here:

| Loop | Runbook | Machine | Interval | Purpose |
|------|---------|---------|----------|---------|
| Bug Patrol | `bug-patrol.md` | Automation Mac | 30m | Auto-fix bugs, escalate features |
| Feature Patrol | `feature-patrol.md` | Primary Mac | 30m | Build features, monitor |
| Daily Digest | `daily-digest.md` | Either | 24h | Morning summary report |
