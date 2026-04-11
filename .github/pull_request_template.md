## Summary

Describe the problem and fix in 2-5 bullets:

- Problem:
- Why it matters:
- What changed:
- What did NOT change (scope boundary):

## Change Type

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor required for the fix
- [ ] Docs
- [ ] Security hardening
- [ ] Chore / infra

## Linked Issue / PR

- Closes:
- Related:
- [ ] This PR fixes a bug or regression

## Root Cause / Regression History

For bug fixes or regressions, explain why this happened, not just what changed.
Otherwise write `N/A`.

- Root cause:
- Missing detection / guardrail:
- Prior context:
- Why this regressed now:
- If unknown, what was ruled out:

## Regression Test Plan

- Coverage level that should have caught this:
  - [ ] Unit test
  - [ ] Integration / seam test
  - [ ] End-to-end test
  - [ ] Existing coverage already sufficient
- Target test or file:
- Scenario the test should lock in:
- Why this is the smallest reliable guardrail:
- If no new test was added, why not:

## Validation

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm protocol:check`
- [ ] `pnpm --dir dashboard build`

Exact commands run and result:

```text
pnpm build
pnpm check
pnpm test
pnpm --dir dashboard build
```

## Human Verification

- Verified scenarios:
- Edge cases checked:
- What you did NOT verify:

## Risk and Recovery

- What could regress:
- What reviewers should inspect closely:
- Fast rollback or disable path:
