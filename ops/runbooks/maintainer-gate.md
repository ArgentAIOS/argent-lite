# Runbook: Maintainer Gate

Use this before merge or promotion.

## Evidence Bar

For bug fixes, maintainers should require:

- symptom evidence
- a code-level root cause
- a fix on the implicated path
- the smallest reliable regression guardrail
- explicit human verification

## Merge Gate

Before recommending merge:

1. verify the PR or handoff describes the real problem
2. verify the scope boundary is explicit
3. verify validation is truthful
4. verify the handoff packet passes `scripts/check-handoff.mjs` if a handoff is involved
5. verify the clean dev/release lane reconstruction
6. require operator sign-off before `main`
