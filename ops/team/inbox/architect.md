# Task 020 — architect

Contract: ops/contracts/architect.contract.md
Slice: ui-and-onboarding-design
Branch: codex/ui-and-onboarding-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/ui-and-onboarding-design.md

## Goal

One document, two sections (≤180 lines total):

### Part A — UI launcher design (~80 lines)

1. Purpose: a web-based launcher served by argent-lite itself on
   `127.0.0.1:7787`. Operator opens their browser (or clicks a
   `.desktop` entry) and sees 4 buttons: Start, Stop, Restart,
   Open ArgentOS Dashboard.
2. Subsystem name: `src/ui/`.
3. Backend endpoints (simple HTTP, no auth since 127.0.0.1 only):
   - `GET /` → static `index.html`
   - `GET /api/status` → JSON `{running, pid, uptimeSec, lastError}`
   - `POST /api/start` → spawns `systemctl --user start argent-lite`
   - `POST /api/stop` → `systemctl --user stop argent-lite`
   - `POST /api/restart` → `systemctl --user restart argent-lite`
   - `POST /api/open-dashboard` → spawns `xdg-open $ARGENT_DASHBOARD_URL`
4. File tree: `src/ui/server.ts`, `src/ui/handlers.ts`, `src/ui/index.html`, `deploy/argent-lite-launcher.desktop`.
5. Security notes: bind only to `127.0.0.1`, never `0.0.0.0`.
   No auth (it's loopback). Reject requests if `host` header is not
   `127.0.0.1:*` or `localhost:*`. No systemctl calls outside a
   whitelisted set of unit names.
6. Integration: the UI server is optional — `bootRuntime` does NOT
   auto-start it; it's its own `argent-lite ui` entrypoint so users can
   opt in.

### Part B — Onboarding wizard + satellite mode wiring (~100 lines)

1. **`argent-lite init`** — interactive wizard, new entrypoint:
   - Detect `~/.argent-lite/config.json` — if present, ask to overwrite.
   - Step 1: mode → `standalone | satellite`.
   - Step 2: choose providers (checkbox prompt): ollama (local),
     groq, openrouter, zai-coder, zai-api, anthropic, openai.
   - Step 3: for each cloud provider, prompt for API key, verify via
     lightweight probe (e.g. models list), store via `CredentialStore`
     (env backend writes `~/.argent-lite/credentials.json.enc`; ask
     for `ARGENT_MASTER_KEY` if not set, generate one if requested).
   - Step 4: if satellite, prompt for Mac brain base URL + HMAC shared
     secret, `ping()` it via `createRuntimeSatelliteClient`.
   - Step 5: write `~/.argent-lite/config.json` via `writeConfig()`.
   - Step 6: print next-steps (start service, open UI).
2. **Satellite mode wiring** — `bootRuntime()` behavior when `mode=satellite`:
   - Still constructs local `MessageBus`, `Scheduler`, `MemoryStore`,
     channels — all local infrastructure stays.
   - Registers a `SatelliteAgent` (new) in place of / alongside
     `RouterAgent`. SatelliteAgent delegates prompts to
     `createRuntimeSatelliteClient` against the Mac brain.
   - On satellite failure, falls back to local router (if providers configured).
   - Optionally starts a `createRuntimeSatelliteServer` listening on
     a port so the Mac can push commands back (Phase 5, flag for later).
3. File plan:
   - `src/cli/init.ts` — interactive wizard.
   - `src/cli/init-prompts.ts` — prompt helpers (pure, testable).
   - `src/agents/satellite-agent.ts` — SatelliteAgent class.
   - `src/integration/runtime.ts` — mode-aware agent selection (edit).
4. Interactive prompts: Node built-in `readline` only, no new deps.
5. Test strategy: inject a fake `Prompter` interface so wizard logic
   is fully unit-testable without TTY.
6. Acceptance criteria for the onboarding slice.

SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/ui-and-onboarding-design`.

Deadline: before next cron tick.
