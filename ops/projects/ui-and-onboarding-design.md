# UI Launcher + Onboarding Wizard — Design (Slice 020)

Author: architect
Date: 2026-04-11
Contract: ops/contracts/architect.contract.md
Status: design, not a claim on implementation

This memo covers two sibling subsystems the operator requested for the
Pi deploy: a loopback web launcher for service control, and an
interactive `argent-lite init` wizard that also finishes wiring satellite
mode into `bootRuntime`. Neither subsystem alters Phase 3 runtime code
paths — both sit at the edges.

---

## Part A — UI launcher (`src/ui/`)

### Purpose
A web-based launcher served by argent-lite itself on `127.0.0.1:7787`.
Operator opens their browser (or clicks a `.desktop` entry) and sees
four buttons: **Start**, **Stop**, **Restart**, **Open ArgentOS
Dashboard**. Shipped as the optional `argent-lite ui` entrypoint so it
never runs inside `bootRuntime` and cannot affect runtime smoke tests.

### File layout
```
src/ui/
  server.ts     # http.createServer + route table, 127.0.0.1 bind
  handlers.ts   # pure request handlers (injectable exec + fetch)
  index.html    # static shell, four buttons, status poll
deploy/
  argent-lite-launcher.desktop  # XDG entry → xdg-open http://127.0.0.1:7787
```

### Endpoints (loopback HTTP, no auth)
| Method | Path                 | Handler           | Response |
| ------ | -------------------- | ----------------- | -------- |
| GET    | `/`                  | serve index.html  | 200 html |
| GET    | `/api/status`        | read unit state   | `{running, pid, uptimeSec, lastError}` |
| POST   | `/api/start`         | exec start        | `{ok}` or 500 |
| POST   | `/api/stop`          | exec stop         | `{ok}` or 500 |
| POST   | `/api/restart`       | exec restart      | `{ok}` or 500 |
| POST   | `/api/open-dashboard`| spawn xdg-open    | `{ok}` |

All unit operations go through a single `runSystemctl(action)` helper
with a hard-coded unit allowlist: `{"argent-lite"}`. `action` is one of
`{"start","stop","restart","status"}`. No operator-supplied strings are
ever concatenated into the argv.

### Security
- Bind only to `127.0.0.1`. Passing `host: "0.0.0.0"` must cause startup
  to fail fast with a named error.
- Reject any request whose `Host` header does not match
  `^(127\.0\.0\.1|localhost)(:\d+)?$`. 400, close connection.
- Reject any `Origin` that is set and not loopback (CSRF guard for
  browsers that send it).
- No cookies, no auth, no CORS allowances. POSTs require
  `Content-Type: application/json` and an empty body; anything else → 415.
- Bound concurrency at one in-flight systemctl call; second request
  returns 429.
- `xdg-open` target is the env var `ARGENT_DASHBOARD_URL`; if unset →
  409 with an operator-friendly message.

### Integration
- `bootRuntime()` **does not** import `src/ui/`. The UI is its own
  entrypoint: `argent-lite ui [--port 7787]`.
- Fatal errors on the UI server do not take down `bootRuntime`; they
  exit only the UI process.
- Test surface: `handlers.ts` is pure (injected `exec`, `readUnit`,
  `open`) and covered by vitest; `server.ts` gets one integration test
  that asserts loopback bind + Host-header rejection.

---

## Part B — `argent-lite init` + satellite mode wiring

### Wizard flow (`src/cli/init.ts`)
New entrypoint `argent-lite init`. All I/O goes through a `Prompter`
interface; the TTY implementation wraps Node's built-in `readline`. No
new dependencies.

1. **Config probe.** Read `~/.argent-lite/config.json`. If present, ask
   "Overwrite existing config? [y/N]". On `n`, exit 0 with a pointer to
   the file.
2. **Mode.** `standalone | satellite` (single-select).
3. **Providers.** Multi-select: `ollama` (local), `groq`, `openrouter`,
   `zai-coder`, `zai-api`, `anthropic`, `openai`. Ollama is default-on
   and free; others default-off.
4. **Credentials.** For each cloud provider, prompt for API key, run a
   lightweight probe (e.g. `GET /v1/models` or provider equivalent) and
   refuse to proceed if the probe fails. Keys are written via the
   existing `CredentialStore` env backend to
   `~/.argent-lite/credentials.json.enc`. If `ARGENT_MASTER_KEY` is not
   set, offer: (a) paste one, (b) generate one and print it once. Never
   store the master key itself.
5. **Satellite link.** If `mode=satellite`: prompt for Mac brain base
   URL + HMAC shared secret, then call `createRuntimeSatelliteClient`
   and `ping()` it. Abort on non-200.
6. **Write config.** `writeConfig()` produces `~/.argent-lite/config.json`
   with `{mode, providers, satellite?: {baseUrl, hmacKeyRef}}`.
7. **Next steps.** Print: `systemctl --user enable --now argent-lite`,
   `argent-lite ui`, and the dashboard URL.

### Test seam (`src/cli/init-prompts.ts`)
All prompt helpers are pure functions over an injected `Prompter`.
The wizard module composes them; unit tests inject a scripted
`FakePrompter` and assert the emitted config + credential writes
without touching a TTY.

### Satellite runtime wiring
Edit `src/integration/runtime.ts` to make agent selection mode-aware:

```
if (mode === "satellite") {
  scheduler.register(wrapAgent(new SatelliteAgent("router", ctx, satCfg)));
  if (satelliteFallbackProviders.length > 0) {
    // keep a local RouterAgent as fallback, registered under a secondary id
  }
} else {
  scheduler.register(wrapAgent(new RouterAgent("router", ctx)));
}
```

- Local infrastructure (`MessageBus`, `Scheduler`, `MemoryStore`,
  channels, intent router, memory-log wrap, metrics) is **unchanged**.
  Only the agent bound to `router` changes.
- `SatelliteAgent` (new, `src/agents/satellite-agent.ts`) implements the
  same `BaseAgent` surface as `RouterAgent` but forwards prompts to
  `createRuntimeSatelliteClient`. On network/timeout/HMAC error it
  falls through to the local `RouterAgent` instance if one is
  registered; otherwise it emits an `agent.error` completion.
- Optional inbound path: if the operator enables it, boot also starts
  `createRuntimeSatelliteServer` on a configured port so the Mac can
  push commands back. Default: **off**, flagged for Phase 5.

### File plan
| Path | New/Edit | Purpose |
| ---- | -------- | ------- |
| `src/cli/init.ts`              | new  | interactive wizard entrypoint |
| `src/cli/init-prompts.ts`      | new  | pure prompt helpers + Prompter iface |
| `src/agents/satellite-agent.ts`| new  | SatelliteAgent forwarding to Mac brain |
| `src/integration/runtime.ts`   | edit | mode-aware agent selection + fallback |
| `src/cli/index.ts`             | edit | register `init` + `ui` subcommands |

### Acceptance criteria (for the implementation slice)
1. `argent-lite init` with `FakePrompter` produces a valid config file
   and a credential blob for every selected provider; all writes routed
   through existing `CredentialStore` / `writeConfig`.
2. Wizard refuses to proceed if a cloud provider probe fails.
3. `bootRuntime({mode:"satellite", ...})` uses `SatelliteAgent` and
   routes prompts through the Mac client; unit test with a stub
   satellite client asserts forwarding and fallback-on-error.
4. `bootRuntime({mode:"standalone", ...})` is byte-identical to today's
   behavior (existing 189/189 tests stay green).
5. No new runtime deps; `pnpm check` + `pnpm test` + `pnpm build` green.

---

## Risks & non-goals
- **No auth on the UI** is only safe because of the loopback bind +
  Host-header guard. If we ever expose 7787 off-box, this design is
  wrong; that would be a separate slice with TLS + token auth.
- **systemctl** assumes a user unit named `argent-lite` exists. Shipping
  the unit file is out of scope here and belongs to a deploy slice.
- **Mac-station patrol model** in the legacy runbooks is still a
  mismatch for this Pi-only deploy; the UI does not try to paper over
  it.
- Wizard does not manage ollama model pulls; operator runs `ollama pull`
  separately. Probing only checks reachability.

## Follow-on slice proposals (names only)
- `ui-launcher-impl`
- `cli-init-wizard`
- `satellite-agent-impl`
- `runtime-mode-selection`
- `deploy-user-unit` (ships the `.service` + `.desktop` files)
