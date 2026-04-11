I have read ops/ and am operating under contract:
ops/contracts/architect.contract.md.

## Decision summary

Argent Lite deploys to Pi 5 as a `tsc`-built tree under `/opt/argent-lite`,
run by systemd as a dedicated `argent` user, config at
`/etc/argent-lite/config.json`, secrets via `/etc/default/argent-lite`
(mode 0600), logs through journald, upgrades by git-tag checkout + rebuild.
Full design (118 lines) in `ops/projects/deploy-design.md`.

## Rationale

- Packaging chosen per `ops/CLAUDE.md` (Node 22 / pnpm 10 env) — no single-
  binary bundler until Hailo native bindings land 2026-04-12.
- Config precedence defers to existing `ops/projects/config-loader-design.md`
  (CLI > env > /etc > ~).
- Secret handling delegates rotation to the existing credential-rotation slice
  rather than re-spec it.
- `scripts/phase3-smoke.sh` already exists on disk and is reused as the
  post-upgrade smoke.
- Mac-station patrol model explicitly called out as non-applicable per
  `ops/CLAUDE.md` "Mac-station mismatch" section.
- No application code created — architect contract forbids it.

## Risks / non-goals

- Non-goal: containerization (operator choice, bare-metal Pi).
- Risk: Hailo-10H driver lands 2026-04-12 — unit may need
  `DeviceAllow=/dev/hailo0 rw` (follow-on slice).
- Risk: `/opt/argent-lite` as a git checkout blurs "artifact" vs "source";
  acceptable for single-host Pi deploy.
- Non-goal: rollback migrations for SqliteMemoryStore — held for a separate
  slice; schema must stay forward-only/additive until then.

## Recommended follow-on slices (names only — not claimed)

- `deploy-installer-impl`
- `deploy-health-endpoint`
- `deploy-rollback-migrations`
- `deploy-hailo-device-acl`

## Files touched

- `ops/projects/deploy-design.md` (new, 118 lines)
- `ops/team/outbox/architect.md` (this file)

## Validation

- `wc -l ops/projects/deploy-design.md` → 118 (≤120, exit 0)
- No code surfaces touched → `pnpm test` / `pnpm build` not applicable to a
  design-memo slice per architect contract ("does not run builds, tests, or
  deploys"). Deferred to `deploy-installer-impl`.

## Contract trace

- Parent: `ops/contracts/team-onboarding.contract.md`
- Role:   `ops/contracts/architect.contract.md`
- Task:   `ops/team/inbox/architect.md` (Task 018, slice `deploy-design`)

## Blockers

None.
