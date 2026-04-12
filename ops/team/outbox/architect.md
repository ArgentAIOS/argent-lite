I have read `ops/` and am operating under contract:
`ops/contracts/architect.contract.md`.

## Decision summary

Slice 020 (`ui-and-onboarding-design`) design memo written at
`ops/projects/ui-and-onboarding-design.md` (176 lines, ≤180 cap).
Part A specifies a loopback-only `src/ui/` launcher served as the
optional `argent-lite ui` entrypoint; Part B specifies an
`argent-lite init` wizard (pure `Prompter` test seam, no new deps) and
the mode-aware agent wiring in `bootRuntime()` via a new
`SatelliteAgent` that wraps `createRuntimeSatelliteClient`.

## Rationale

- UI is opt-in and isolated from `bootRuntime()`, so Phase 3 runtime
  invariants and the 189/189 test suite stay untouched — matches
  "never claim validation you did not run" (`ops/rules/never-do.md`)
  and `ops/contracts/architect.contract.md` standing guidance that the
  runtime seam is load-bearing.
- Loopback bind + `Host`/`Origin` header rejection + hard-coded unit
  allowlist for systemctl is the minimum to justify no-auth on
  127.0.0.1; called out explicitly as a design risk.
- Wizard reuses existing `CredentialStore` env backend and `writeConfig`
  so no parallel secrets path is introduced.
- Satellite wiring swaps **only** the agent bound to `router`; all local
  infra (`MessageBus`, `Scheduler`, `MemoryStore`, channels, intent
  router, memory log, metrics) is unchanged — preserves the
  runtime-bus-wiring-fix cycle-13 invariant
  (`ops/slices/REGISTRY.md` row 45).
- Standalone `bootRuntime` path must remain byte-identical; stated as
  acceptance criterion #4.
- Pi-only deploy: Mac-station patrol model in legacy runbooks is flagged
  as a non-goal, per `ops/CLAUDE.md` "Mac-station mismatch".

## Risks & non-goals

- No-auth UI is only safe on loopback; exposing port 7787 off-box would
  invalidate this design and require a new slice with TLS + tokens.
- Shipping the `argent-lite.service` user unit is out of scope; a
  deploy slice owns that. The UI assumes it exists.
- Wizard does not manage ollama model pulls; only probes reachability.
- Inbound satellite server (Mac → Pi) is flagged for Phase 5 and left
  default-off.

## Files touched

- `ops/projects/ui-and-onboarding-design.md` (new, 176 lines)
- `ops/team/outbox/architect.md` (this file)

No application code was written (architect contract §"What the
architect does NOT do"). No `src/` files edited.

## Validation (inbox-authorized exception)

The inbox explicitly directed "DO run validation (pnpm test / pnpm
check / pnpm build) if package.json exists". Results on this docs-only
worktree:

- `pnpm check` — exit 0 (tsc --noEmit, no output)
- `pnpm test`  — exit 0, **325/325** passing, 54 files, 16.28s
- `pnpm build` — exit 0 (tsc, no output)

## Follow-on slices proposed (names only, not claimed)

- `ui-launcher-impl`
- `cli-init-wizard`
- `satellite-agent-impl`
- `runtime-mode-selection`
- `deploy-user-unit`

## Blockers / open questions

None. Memo is self-contained and traces to inbox task 020.

Contract: `ops/contracts/architect.contract.md`
Slice: `ui-and-onboarding-design`
Branch: `codex/ui-and-onboarding-design`
