# Runbook: Incident Response

> What to do when https://argentos.ai goes down or a critical service fails.

## Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| **SEV-1** | Site completely down | Immediate | https://argentos.ai returns 5xx or timeout |
| **SEV-2** | Major feature broken | Within 1 hour | Auth failing, database unreachable, core feature broken |
| **SEV-3** | Degraded performance | Within 4 hours | Slow responses (>3s), intermittent errors |
| **SEV-4** | Minor issue | Next patrol cycle | UI glitch, non-blocking error |

## Detection

Incidents are detected by:
- **Bug Patrol / Feature Patrol**: `curl https://argentos.ai` every 30 min
- **User bug reports**: GitHub Issues on ArgentAIOS/argent-lite
- **Hosting platform alerts**: Dashboard notifications
- **Manual report**: Team members report via email/chat

## Triage Checklist (SEV-1 / SEV-2)

Run these checks in order. Stop when you find the root cause.

### 1. Confirm the outage
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://argentos.ai
```

### 2. Send immediate alert
```bash
bash scripts/send-escalation-email.sh "ALERT: https://argentos.ai is DOWN — investigating"
```
Do NOT wait for diagnosis. Alert first, then investigate.

### 3. Check hosting platform
- Check if a recent deploy failed or is still building
- Check service logs for crash loops or OOM kills
- Check if the platform has a maintenance window

### 4. Check database connectivity
- Can the app reach the database?
- Is the connection pool exhausted?
- Is storage running low?

### 5. Check recent deploys
```bash
git log main --oneline -5
gh pr list --repo ArgentAIOS/argent-lite --state merged --limit 5
```

## Resolution Actions

### Rollback a bad deploy
If the last deploy caused the outage:
```bash
git revert <bad-commit-hash>
git push origin fix/revert-bad-deploy
gh pr create --title "revert: Roll back bad deploy" --body "Reverts <hash> which caused site outage"
```
Never push directly to main — use a PR even for hotfixes.

### Environment variable missing
- Check hosting platform environment variables
- Common missing vars: database URL, API keys, secrets

## Post-Incident

After the site is back up:

1. **Confirm recovery**: `curl https://argentos.ai` returns 200
2. **Send recovery alert**:
   ```bash
   bash scripts/send-escalation-email.sh "RESOLVED: https://argentos.ai is back up — root cause: [description]"
   ```
3. **Document in JOURNAL**: Write an entry in `ops/log/JOURNAL.md` with:
   - When the outage started and was detected
   - Root cause
   - Fix applied
   - Prevention steps
4. **Create a GitHub Issue** if the root cause needs a permanent fix
5. **Update monitoring** if the detection gap was too long

## Escalation Chain

| Priority | Who | Contact |
|----------|-----|---------|
| First | operator | owner@argentos.ai |

## Never Do During an Incident

- Never push directly to main (use a PR even for hotfixes)
- Never modify the production database without a backup
- Never ignore a failed deploy — always investigate
- Never skip the post-incident journal entry
