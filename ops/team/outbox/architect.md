I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary
Phase 3 §4 smoke failures trace to three local bugs in the runtime seam.
`src/runtime/event-kinds.ts` is authoritative; `memory-router.ts` and
`runtime.ts` must conform (not the other way round). Bus→agent delivery
is not "missing" — it is a shutdown race compounded by unwired providers
in `runChat` and a double-listener on the `"router"` mailbox. Reply
routing works by accident via an unpinned `msg.from` convention.

Plan written at `ops/projects/phase3-bugfix-plan.md` (47 lines, within
the ≤100-line inbox limit). It enumerates the three bugs with
line-level citations, gives the canonical fix owner/file/behavior/test
for each, resolves the vocabulary question (keep the lock, conform the
producers), and proposes four cycle-14 sub-slices.

## Rationale (rule/runbook citations)
- `ops/projects/event-kind-vocabulary.md` §1/§2/§4 — 5-kind set is
  frozen; `router.out` is success-only; `router.error` is disallowed;
  adding kinds requires an architect slice + retention/metrics
  migration. Picks the vocabulary direction deterministically.
- `ops/projects/phase3-acceptance.md` §4/§7.3 — smoke grep is the
  gate; plan §5 keeps it out of scope (runtime conforms, script does
  not change).
- `ops/contracts/architect.contract.md` — output is a decision memo
  at `ops/team/outbox/architect.md`; inbox authorized edits to
  `ops/projects/phase3-bugfix-plan.md`. No application code written.
- `ops/rules/branching.md` — worked on `codex/phase3-bugfix-plan`,
  PR targets `codex/ops-team-bootstrap` per inbox §3.

## Files touched
- `ops/projects/phase3-bugfix-plan.md` (new, 47 lines)
- `ops/team/outbox/architect.md` (this file)

## Validation
Per the architect contract, I do not run builds or tests. `pnpm test`
status is unchanged from the cycle-12 baseline (188/188); this slice
authorizes no code changes. The engineer sub-slices in plan §4 are
the ones that must turn the four new test cases green.

## Commits / PR
Commit on `codex/phase3-bugfix-plan`, pushed to origin, PR opened
against `codex/ops-team-bootstrap`. See trailing commit hash + PR URL
in the pane output.

## Blockers / open questions
- **For threadmaster:** slice 2 (`phase3-bugfix-dispatch`) touches
  `src/agents/base-agent.ts` to add an `autoSubscribe` opt-out. That
  file sits outside the `phase3-*` implementation surface in REGISTRY
  as currently drawn. Please confirm the surface expansion before
  engineer-router starts, or split the opt-out into its own
  `base-agent-autosubscribe` slice owned by engineer-floor.
- **For threadmaster:** slice 1 (`phase3-bugfix-vocab`) deletes the
  cycle-12 fallback allowlist in `runtime.ts`. That fallback was the
  safety net during the event-kind-lock merge window. Confirm the
  lock slice is permanently on `main` so the fallback can be deleted
  outright (not feature-flagged).

Contract reference: `ops/contracts/architect.contract.md`.
