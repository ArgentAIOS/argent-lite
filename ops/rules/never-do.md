# Never Do

## Merge Discipline
- Never merge directly from a dirty implementation slice to `main`.
- Never ask Threadmaster to trust branch name alone when commit/file truth is stronger.
- Never mix unrelated repo changes into one handoff packet.
- Never claim validation you did not run.
- Never skip explicit exclusions when handing off from a dirty tree.
- Never push directly to `main` — all changes must go through PRs.

## Quality Gates
- Never send PR email until CI passes AND code review has no blocking issues.
- Never push a review fix without commenting on the PR with what was flagged, what was changed, and the commit hash. Every correction needs an audit trail.
- Never merge without all quality gates: CI green + review complete + email sent.
- Never leave a bug fix PR open after all quality gates pass. CI green + review clear + email sent = MERGE IMMEDIATELY. An unmerged green PR is an incomplete task.
- Never create multiple PRs in a single patrol cycle. All bug fixes found in one cycle go on ONE branch, ONE PR, ONE merge. Each merge triggers a deploy — batching prevents deploy spam.
- Never skip changelog updates — every feature, fix, and security change gets documented.

## Feature Requests
- Never auto-implement feature requests — only bugs get auto-fixed.
- Never build features without operator approval.
- Never skip escalation email for feature requests: `bash scripts/send-escalation-email.sh <issue-number>`

## Loop Discipline
- Never start a loop cycle without running Phase 0 (sync and review). Pull latest, re-read your runbook and ops rules from disk. See `ops/runbooks/loop-contract.md`.

## Production Safety
- Never ignore a deployment failure or site outage — send alert immediately.
- Never modify the production database without a backup.
- Never push without ops sync: REGISTRY, ACTIVE, JOURNAL all up-to-date.
