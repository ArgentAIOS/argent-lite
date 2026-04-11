I have read `ops/` and am operating under contract:
`ops/contracts/architect.contract.md`.

## Summary

Produced the Phase 2 gate planning document
`ops/projects/agent-topology-lite.md` (129 lines, ≤200 cap) per the
`research-planning.md` §9 shape. The design picks a single-process,
cooperative-scheduler, 3-agent pool on an in-proc typed EventEmitter
bus, with `ModelRouter` as the only provider choke point. Satellite
mode pins `worker`/`reflector` to the Mac via a `RemoteAgentProxy`
stub; standalone mode runs the full three-agent set locally. Six
sub-slices are enumerated in dependency order. Planning-only: **no
implementation has started**, no code touched under `src/`.

## Decision summary (1–3 sentences)

Argent Lite will run a single-process agent pool (max 3 concurrent,
cooperative) with an in-proc typed EventEmitter bus for best-effort
delivery and `ModelRouter` as the sole dispatch point. The same three
seed agents (`triage`, `worker`, `reflector`) run in both modes, but
satellite mode pins `worker`/`reflector` to the Mac through a
`RemoteAgentProxy` so mode stays a config flag, not a fork. Phase 3
unblocks once runtime + bus + scheduler + seed agents (sub-slices 1–4)
are merged and a smoke test proves `triage → worker → router`
end-to-end.

## Rationale

- **Single process, no `worker_threads`** — `ops/CLAUDE.md` notes the
  Pi 5 / 16 GB / CPU-only reality; `ops/projects/argent-lite-scope-decision.md`
  explicitly excludes fan-out topologies as compute-incompatible. IPC
  and serialization cost on Pi would dwarf the concurrency win before
  Hailo is even characterized.
- **Agents consume `ModelRouter`, never providers directly** — Phase 1
  shipped `ModelRouter` + `local-first`/`cost` policies
  (`ops/slices/REGISTRY.md`, Phase 1 integration row). Keeping it as
  the only dispatch seam preserves the policy boundary the router was
  designed around (`src/router/types.ts`).
- **In-proc bus, best-effort, no persistence** —
  `ops/runbooks/research-planning.md` §3 warns against quietly turning
  planning into implementation; a durable queue belongs to
  `memory-lite` per the scope decision's DEFER table, so Phase 2 must
  stop short of it.
- **Mode is a config flag, not a fork** — `ops/CLAUDE.md`: "mode is a
  runtime configuration, not a fork." `RemoteAgentProxy` keeps both
  modes on one codebase and isolates the (still-undecided) satellite
  wire protocol behind a single seam.
- **Six sub-slice ordering** — follows
  `ops/runbooks/slice-management.md` §6 (narrow surfaces) and §8
  (planning vs. implementation separation): each sub-slice is its own
  branch, no parallel implementation until sub-slice 1 merges.
- **Scope discipline** — no new contracts, runbooks, or rules authored;
  the architect contract (`ops/contracts/architect.contract.md`)
  forbids that and this work is strictly planning output.

## Risks and non-goals

- **Risk: per-agent memory cap.** Node has no cheap per-async-context
  heap limit; Phase 2 leans on wall-clock budgets + global heap cap.
  Revisit if Hailo workloads push RSS (open question #1 in the doc).
- **Risk: satellite auth ambiguity.** `RemoteAgentProxy` needs an auth
  stub before `satellite-protocol` exists; the doc proposes reusing
  `src/auth/` to avoid a second credential store (open question #4).
- **Risk: Mac-station runbook drift.** `ops/CLAUDE.md` already flags
  the two-station patrol model as broken on this Pi deploy; Phase 2
  sub-slices must not inherit it.
- **Non-goal:** no implementation code, no Hailo-specific scheduling,
  no memory design, no satellite wire protocol, no agent sandboxing.

## Files touched

- `ops/projects/agent-topology-lite.md` — **created** (129 lines)
- `ops/team/outbox/architect.md` — this file

No files touched outside the authorized surface. No `src/`, no
`package.json`, no contracts, no runbooks, no rules modified.

## Validation

- `wc -l ops/projects/agent-topology-lite.md` → **129** (≤200 ✅)
- `ls ops/projects/` → confirms `agent-topology-lite.md` present ✅
- `pnpm test` / `pnpm build` — **not run**: this is a planning slice
  touching only `ops/`, no code changed, and the architect contract
  forbids running builds/tests. Skipping is correct per the task shape.

## Recommended follow-on slices (names only, no claims)

1. `agent-runtime-lite` — `AgentRuntime`, types, lifecycle
2. `agent-bus-lite` — in-proc typed EventEmitter bus
3. `agent-scheduler-lite` — cooperative pool (concurrency=3, per-task timeout)
4. `agent-seeds-lite` — `triage` + `worker` + `reflector` wired to `ModelRouter`
5. `agent-remote-proxy-lite` — satellite-mode stub seam (no wire protocol)
6. `agent-topology-integration` — end-to-end smoke in both modes

Sub-slices must open sequentially; 1 merges before 2 branches. Phase 3
(`memory-lite`, `intent-routing-lite`, `channels-lite`) stays locked
until sub-slices 1–4 are merged and smoke passes per the doc's Phase 3
unblock conditions.

## Blockers / open questions

- None blocking this planning slice.
- Five open questions documented in `ops/projects/agent-topology-lite.md`
  (memory cap, crash granularity, `reflector` router budget, satellite
  auth, Mac-station runbook drift) — all deferred to the relevant
  sub-slice or to threadmaster.
- **Awaiting threadmaster/operator sign-off** before any
  `agent-*-lite` implementation branch opens, and before REGISTRY is
  updated to add this slice as `planning-complete` (architect does not
  edit REGISTRY).

This is planning-only. No implementation has started. Ready for
threadmaster review.
