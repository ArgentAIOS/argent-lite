# Runbook: Bug Fix Workflow

> End-to-end process for fixing a bug from GitHub Issue to deployment.

## Step 1: Classify

**FIRST**: Is this actually a bug, or a feature request? See `ops/runbooks/bug-patrol.md` for classification rules. If it's a feature request, escalate — do not fix.

## Step 2: Identify

```bash
gh issue view <number> --repo ArgentAIOS/argent-lite
```

Read the issue description, reproduction steps, and any screenshots.

## Step 3: Claim

If the fix is significant (multi-file, risky, or touches core logic):
- Claim a slice in `ops/slices/REGISTRY.md`
- Create a branch: `fix/issue-{number}-short-description`

## Step 4: Scout

Investigate root cause before writing code:
- Read the affected files
- Check git blame for recent changes
- Reproduce the issue if possible
- Identify the minimal fix

## Step 5: Fix

- Minimal change — don't refactor surrounding code
- Follow project rules (theme, auth, coding patterns)
- Don't introduce new dependencies unless absolutely necessary

## Step 6: Build

```bash
pnpm build
```
Must pass with zero errors.

## Step 7: Create PR

```bash
gh pr create --repo ArgentAIOS/argent-lite --title "fix: description" --body "Fixes #<number>. Root cause: ..."
```

## Step 8: Quality Gates

Follow `ops/runbooks/pr-workflow.md`:
1. Wait for CI to pass
2. Wait for code review
3. Fix any issues, push, repeat
4. Send PR email when all green

## Step 9: Close

```bash
gh issue close <number> --repo ArgentAIOS/argent-lite --comment "Fixed in PR #<pr-number>: [description of fix]"
```

## Step 10: Update Ops

If the fix was significant:
- Update changelog
- Update `ops/slices/REGISTRY.md` status
- Write a journal entry in `ops/log/JOURNAL.md`
