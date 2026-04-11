# Runbook: Research and Planning Work

1. Use this runbook when the request is research-only, planning-only, or architecture-only.
2. Separate the work into three phases:
   - research
   - planning package
   - future implementation slice definition
3. Do not quietly turn a planning branch into an implementation branch.
4. Research must answer:
   - where the current project is stronger
   - where the compared system is stronger
   - what should be adopted
   - what should explicitly not be adopted
   - which follow-on slices are worth opening
5. If the research is meant to drive future work, create a tracking issue even if only `ops/` files changed.
6. The planning package should create or update:
   - `ops/projects/<project>.md`
   - `ops/projects/ACTIVE.md`
   - `ops/slices/REGISTRY.md`
   - `ops/log/JOURNAL.md`
7. Planning slices should use planning-specific statuses:
   - `researching`
   - `planning-complete`
   - `implementation-not-started`
8. Do not mark a planning artifact as `ready-to-merge` unless the plan document itself is the intended merge output.
9. The planning brief should include:
   - decision summary
   - scope
   - explicit non-goals
   - candidate file areas
   - phased execution order
   - future slice breakdown
   - acceptance criteria
   - open questions
10. If the work will be handed back to Threadmaster, state clearly:
   - this is planning-only
   - no implementation has started
   - which future slices should be opened next
