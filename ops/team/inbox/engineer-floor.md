# Task 007 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: hailo-bootstrap
Branch: codex/hailo-bootstrap (worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- scripts/hailo-setup.sh
- scripts/hailo-check.sh
- docs/hailo-setup.md
- src/providers/hailo-runtime.ts
- tests/providers/hailo-runtime.test.ts

## Context

Raspberry Pi AI HAT+ 2 with Hailo-10H arrives 2026-04-12 (tomorrow).
Pre-stage a setup script and a runtime probe so we can plug the board
in and verify in under 60 seconds.

## Goal

1. **`scripts/hailo-setup.sh`** — bash, `set -euo pipefail`. Steps:
   - `lsmod | grep hailo` — report loaded kernel module (ok if absent; warn).
   - `lspci | grep -i hailo` — detect the card. Report vendor/device ID.
   - `command -v hailortcli` — check Hailo runtime CLI is installed; if
     missing, print the install command and exit 2.
   - `hailortcli fw-control identify` — query the card if the CLI is present.
   - Write a structured summary to `/tmp/hailo-setup-$(date +%s).log`.
   - Exit 0 on success, 2 on recoverable gaps (CLI missing), 1 on unexpected.
   - Pure probe — never installs, never modifies system state.
2. **`scripts/hailo-check.sh`** — thinner, returns exit 0 iff a Hailo-10H
   is present and responsive; meant for CI and nightly smoke.
3. **`docs/hailo-setup.md`** — one page:
   - Hardware: Raspberry Pi AI HAT+ 2 (Hailo-10H), PCIe Gen 3 x4.
   - Reference: Pudding Entertainment Medium article (URL in a comment).
   - Debian 12 install steps (apt packages, pcie_aspm=off, reboot).
   - Purge order if Hailo-8 stack was installed previously.
   - Smoke: run `scripts/hailo-check.sh`.
4. **`src/providers/hailo-runtime.ts`** — exports `probeHailo(): Promise<{present: boolean; deviceId?: string; firmware?: string; error?: string}>`.
   Uses `child_process.execFile` to call `hailortcli fw-control identify`
   and parse stdout. Never throws — returns the error in the object.
5. **`tests/providers/hailo-runtime.test.ts`** — mocks
   `node:child_process.execFile` via `vi.mock`, asserts:
   - when the command succeeds with sample output, returns `{ present: true, ... }`
   - when the command is missing (ENOENT), returns `{ present: false, error: ... }`

## Constraints

- Node built-ins only. Use `node:child_process` and `node:util`
  (for `promisify`).
- Do NOT touch `src/providers/hailo.ts` — that's the cycle-4 stub and
  stays untouched.
- Strict TS, ESM, no `any`.

## Acceptance criterion

- All 5 files exist.
- `bash -n scripts/hailo-setup.sh` && `bash -n scripts/hailo-check.sh` pass.
- `pnpm check && pnpm test tests/providers/hailo-runtime.test.ts` pass.
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline

Before next cron tick.
