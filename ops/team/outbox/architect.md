I have read `ops/` and am operating under contract:
`ops/contracts/architect.contract.md`.

## Decision summary

Argent Lite Phase 3 memory is **one** SQLite-backed `MemoryStore`:
per-agent key-value table plus an append-only `events` log, one writer,
async-mutex serialized. No Postgres, no Redis, no in-process upgrade
path. Satellite-mode memory sync is explicitly deferred.

## Rationale

- SQLite-only aligns with `ops/CLAUDE.md` Pi 5 constraints and the
  standing-guidance note against assuming runtime code that doesn't exist.
- Single-writer mutex mirrors the scheduler model already landed in
  `ops/projects/agent-lifecycle-design.md` (deterministic, cooperative).
- Planning-doc shape follows `ops/runbooks/research-planning.md` §9
  (decision, scope, non-goals, file areas, phased slices, acceptance,
  open questions).
- Slice structure respects `ops/rules/branching.md` (`codex/*`
  implementation branches, one surface per slice) and
  `ops/rules/never-do.md` (no cross-slice file writes).

## Files touched

- `ops/projects/memory-lite-design.md` (new, 142 lines)
- `ops/team/outbox/architect.md` (this file)

Surface authorized by inbox: both. No files outside that surface touched.

## Validation

- `wc -l ops/projects/memory-lite-design.md` → 142 (≤150 budget).
- `pnpm` validation skipped — architect contract forbids builds/tests
  and this is a doc-only slice.
- No cross-slice edits; `git status` clean outside the authorized surface.

## Recommended follow-on slices (names only)

- `memory-store-impl` — `src/memory/{index,types,errors,sqlite-store,mutex}.ts` + unit tests.
- `memory-retention` — `src/memory/retention.ts` + TTL/cap tests.
- `memory-telemetry` — counters in `src/integration/**` + demo-runner print path.

`memory-store-impl` is the gatekeeper; `intent-routing-lite` and
`channels-lite` stay `researching` until §7 of the design doc is
satisfied.

## Risks / non-goals

- Driver choice (`node:sqlite` vs `better-sqlite3`) unresolved — flagged
  as open question #1 for engineer-router.
- Mac-station patrol model and clean-lane worktrees are irrelevant to
  this slice (Pi-only deploy).
- Encryption at rest for `memory.sqlite` is deferred; flagged to the
  provider-auth owner if threat model changes.

## Blockers

None. Ready for team lead to open `memory-store-impl`.

## Contract trace

`ops/contracts/architect.contract.md` · parent
`ops/contracts/team-onboarding.contract.md` · runbook
`ops/runbooks/research-planning.md` §9.
