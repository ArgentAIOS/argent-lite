# Runbook: Health Monitoring

> Deep health checks beyond the basic `curl https://argentos.ai` ping. Use when response times are degrading or after a deploy.

## Quick Health Check (Every Patrol Cycle)

```bash
curl -s -o /dev/null -w "status:%{http_code} time:%{time_total}s" https://argentos.ai
```

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Status code | 200 | 3xx (redirect loop) | 4xx/5xx |
| Response time | < 0.5s | 0.5s–2.0s | > 2.0s |

## Deep Health Checks

Run these after a deploy, when the quick check shows degradation, or once per day as baseline:

```bash
# Homepage
curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://argentos.ai

# API health (if applicable)
curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://argentos.ai/api/health
```

### Database
- Connection test
- Active connection count (approaching pool limit = danger)
- Database size and storage usage

### Response Time Trending

Track response times across patrol cycles. If you see a trend:

| Pattern | Likely Cause | Action |
|---------|-------------|--------|
| Gradual increase over hours | Memory leak, connection pool exhaustion | Restart service |
| Spike after deploy | Bad code in new deploy | Check recent commits, consider rollback |
| Intermittent spikes | Contention, cold starts | Monitor, may self-resolve |
| Consistently > 1s | Under-provisioned resources | Alert operator |

## Alerting Thresholds

| Check | Threshold | Action |
|-------|-----------|--------|
| Site returns non-200 | Any occurrence | Follow `incident-response.md` immediately |
| Response time > 2s | 2 consecutive cycles | Log warning in JOURNAL |
| Response time > 5s | Any occurrence | Treat as SEV-2, follow `incident-response.md` |
| Database unreachable | Any occurrence | Treat as SEV-1, follow `incident-response.md` |

## Integration with Patrol Loops

Both Bug Patrol and Feature Patrol run health checks every cycle. The basic check is:

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://argentos.ai
```

Deep checks should be run:
- After every deploy
- When basic check shows degradation
- Once per day as a baseline
- On demand when investigating an issue
