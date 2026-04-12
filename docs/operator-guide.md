# Argent Lite — operator guide

Simple reference for what runs, what it does, and how to poke it.
For design + rationale, see `ops/projects/*.md`. This doc is
**operator-facing only**: start, stop, restart, check, fix.

---

## 1. The services

Argent Lite runs as up to **three** systemd units. Only the first is
required. The other two are opt-in.

| Unit | What it does | Port | Required? |
|---|---|---|---|
| `argent-lite.service` | The brain. Runs `argent chat`, loads memory, talks to LLM providers, processes prompts. | none (stdin-driven) | **yes** |
| `argent-lite-ui.service` | Browser launcher. 4 buttons: Start / Stop / Restart / Open Dashboard. | `127.0.0.1:7787` | optional |
| `argent-lite-kiosk.service` | Voice+touchscreen UI for the walk-up satellite (mic, speaker, orb on 7" display). | `127.0.0.1:7788` | optional (kiosk deploy only) |
| `pi-dashboard.service` | Operator HUD: CPU/NVMe temps, fan PWM control, CPU/mem/disk, apt updates, live service health (probes every listener above). Runs as root (sysfs fan control). **Merged launcher controls**: start/stop/restart `argent-lite` and `argent-gateway`, open ArgentOS Desktop, reserved Kiosk slot. Opt in with `ARGENT_INSTALL_DASHBOARD=1` at install time. | **`0.0.0.0:9090`** (see hardening) | optional |
| `argent-gateway.service` | ArgentOS WebSocket gateway (`pnpm run gateway:dev` in `$ARGENT_CORE_DIR`). Serves the React dashboard at :8080 — agent streams, chat RPC, workflow canvas, system registry all talk here. Token-authenticated; same token goes in the dashboard's `.env.local` as `VITE_GATEWAY_TOKEN`. Opt in with `ARGENT_INSTALL_GATEWAY=1 ARGENT_CORE_DIR=/path/to/argentos-core` at install time. | `127.0.0.1:18789` | optional |

**Argent services** are loopback-only by default. **`pi-dashboard`** is
the exception — it binds `0.0.0.0:9090` so you can reach the HUD from
another machine on your LAN. On a single-operator Pi behind
`ufw default deny incoming` this is fine; for anything else, change
the bind to `127.0.0.1` in `deploy/pi-dashboard/dashboard.py` and SSH-
tunnel the port. There is **no auth** on the HUD — fan control is a
real hardware knob, `pwm=0` stops the fan, handle accordingly. See
`deploy/pi-dashboard/HANDOFF.md` §"Security / hardening".

---

## 2. Where things live

| Path | What |
|---|---|
| `/opt/argent-lite/` | Built code (`dist/`), installed by `scripts/install.sh`. |
| `/etc/systemd/system/argent-lite.service` | The main unit. |
| `/etc/default/argent-lite` | Env file. Holds `ARGENT_MASTER_KEY` and optional provider keys. Mode `0600`. |
| `~/.argent-lite/config.json` | Runtime config: mode, providers, channels. Written by `argent-lite init`. |
| `~/.argent-lite/credentials.json.enc` | AES-256-GCM-encrypted API keys. Written by the init wizard. Mode `0600`. |
| `~/.argent-lite/memory.sqlite` | SQLite KV + event log. Holds prompts + completions. |
| `/var/log/argent-lite/*.log` | JSON-line logs from the structured logger (once wired). |
| `journalctl -u argent-lite` | Everything stdout/stderr falls here by default. |

---

## 3. First-time setup

Run these **once**, in order, after cloning the repo:

```bash
# 1. Build
cd /home/jason/code/argent-lite
pnpm install --frozen-lockfile
pnpm check && pnpm test && pnpm build

# 2. Configure
node dist/src/cli/init.js         # interactive wizard: mode, providers, API keys

# 3. Install service
sudo bash scripts/install.sh      # copies dist/, installs unit, reloads systemd
#    Combined install (HUD + gateway):
#    sudo ARGENT_INSTALL_DASHBOARD=1 \
#         ARGENT_INSTALL_GATEWAY=1 \
#         ARGENT_CORE_DIR=/home/jason/code/argentos-core \
#         bash scripts/install.sh

# 4. Put your master key in the env file (once, one line)
sudo install -m 600 deploy/env.example /etc/default/argent-lite
sudo nano /etc/default/argent-lite    # set ARGENT_MASTER_KEY=<your-hex-key>

# 5. Enable + start
sudo systemctl enable --now argent-lite
```

Verify:

```bash
systemctl status argent-lite        # should say "active (running)"
bash scripts/phase3-smoke.sh        # should print PASS
```

---

## 4. Day-to-day operation

### Start / stop / restart

```bash
sudo systemctl start argent-lite
sudo systemctl stop argent-lite
sudo systemctl restart argent-lite        # apply a config change
sudo systemctl reload-or-restart argent-lite
```

### Check status

```bash
systemctl is-active argent-lite                            # one-word answer
systemctl status argent-lite                               # full state + last 10 log lines
systemctl list-units 'argent-lite*'                         # see all argent units
```

### Watch logs

```bash
journalctl -u argent-lite -f                               # live tail
journalctl -u argent-lite --since "10 min ago"             # recent history
journalctl -u argent-lite -p err                           # errors only
journalctl -u argent-lite -o json-pretty                   # raw JSON log records
```

### Send a prompt (no UI)

```bash
echo "what is 2+2" | systemd-cat -t argent-manual \
  /opt/argent-lite/dist/src/cli/chat.js                    # one-shot
```

Or with the Phase 1 one-shot CLI (no memory, no runtime seam):

```bash
/opt/argent-lite/dist/src/cli/index.js "hello"
```

### Inspect memory

```bash
node --experimental-sqlite -e '
  const s = require("node:sqlite");
  const db = new s.DatabaseSync(process.env.HOME + "/.argent-lite/memory.sqlite");
  console.log(db.prepare("SELECT kind, COUNT(*) c FROM events GROUP BY kind").all());
  console.log(db.prepare("SELECT kind, ts, payload_json FROM events ORDER BY ts DESC LIMIT 10").all());
'
```

---

## 5. Optional UI launcher (`argent-lite-ui`)

A loopback-only HTTP page with Start / Stop / Restart / Open-Dashboard
buttons. Intended for debugging over SSH with port-forward, or on a
desktop Pi.

```bash
# Run on demand (foreground):
node /opt/argent-lite/dist/src/cli/ui.js
# → open http://127.0.0.1:7787 in any browser on the Pi

# Or from your laptop over SSH:
ssh -L 7787:127.0.0.1:7787 pi5miniAI
# then open http://127.0.0.1:7787 locally
```

Security: binds `127.0.0.1` only. Rejects any request whose `Host`
header is not `127.0.0.1:7787` or `localhost:7787`. No auth (it's
loopback — if an attacker is already inside your loopback they have
shell already).

---

## 6. Optional kiosk mode (`argent-lite-kiosk`)

Runs on a Pi with a 7" touchscreen + mic + speaker + camera.
Full-screen voice-first UI with the AEVP orb.

```bash
sudo systemctl enable --now argent-lite-kiosk
```

This service:

1. Starts a local HTTP server on `127.0.0.1:7788`.
2. Launches `chromium --kiosk http://127.0.0.1:7788`.
3. Subscribes to mic via `arecord` → Groq Whisper STT.
4. Publishes TTS replies via ElevenLabs → `aplay`.
5. Talks to the main `argent-lite.service` over the MessageBus.

Kiosk autostart is handled by `deploy/argent-lite-kiosk.desktop`
dropped into `~/.config/autostart/`.

---

## 7. Running against a different provider

Providers are chosen in `~/.argent-lite/config.json`:

```json
{
  "mode": "standalone",
  "providers": ["ollama", "groq", "openrouter"],
  "logLevel": "info",
  "channels": ["cli-stdio"]
}
```

Order in the array is **preference order**. Router uses policy
`local-first` by default, so `ollama` is tried first, then cloud
providers in array order, with failure fallback + circuit breaker +
rate limiting applied automatically.

After editing, restart:

```bash
sudo systemctl restart argent-lite
```

---

## 8. Common fixes

| Symptom | Fix |
|---|---|
| `systemctl status` shows `inactive (dead)` after boot | `sudo systemctl enable argent-lite` — it wasn't enabled |
| `error: ModelRouter: no providers registered` | Your `config.json` `providers` array is empty. Edit + restart. |
| `error: node:sqlite is not available` | Upgrade Node to ≥22.5 or run with `--experimental-sqlite`. |
| `error: MemoryStoreError: ARGENT_MASTER_KEY not set` | Set it in `/etc/default/argent-lite` (root `0600`), then restart. |
| CI smoke PASS but real-ollama smoke hangs | Pi load is too high. `uptime` — if load >6, let it cool. `scripts/phase3-ollama-smoke.sh` auto-SKIPs when overloaded. |
| UI launcher page loads but buttons do nothing | Your user isn't in the `systemd-journal` group, OR `systemctl --user` isn't configured. Run `systemctl --user` commands directly to test. |
| Can't reach UI launcher from laptop | It's loopback-only. Use `ssh -L 7787:127.0.0.1:7787 pi5miniAI`. |
| Kiosk shows "HelloAgent not available" | Build is stale — `sudo bash scripts/install.sh` to redeploy. |
| Memory file grew huge | `memory.retention` wrapper caps event log per agent, but you can also manually `sqlite3 ~/.argent-lite/memory.sqlite "DELETE FROM events WHERE ts < <cutoff>"`. |
| Hailo probe says not present | Expected until 2026-04-13 (hardware arrives). Provider stub returns `HailoUnavailableError`, router falls through to next provider automatically. |

---

## 9. Uninstall

```bash
sudo systemctl disable --now argent-lite argent-lite-ui argent-lite-kiosk pi-dashboard
sudo bash scripts/uninstall.sh
# Leaves ~/.argent-lite/ and /etc/default/argent-lite alone — remove manually if you want.
```

## 9b. pi-dashboard operator HUD + launcher

Optional. Install with `ARGENT_INSTALL_DASHBOARD=1` on `scripts/install.sh`.

Single operator entry point at `http://<pi-host>:9090` — shows temps /
fan / CPU / memory / disk / apt updates / service health and embeds
start/stop/restart controls for both `argent-lite` and `argent-gateway`
in the "Argent Lite Runtime" card. The header has two launcher
buttons: **ArgentOS Desktop** (opens React UI at :8080 in a new tab)
and **Kiosk** (placeholder until cycle-21).

The Desktop button auto-disables (dims + tooltip) when the gateway
isn't listening on :18789, so the operator is pushed to start the
gateway before opening the dashboard.

```bash
# Start / stop / restart
sudo systemctl enable --now pi-dashboard
sudo systemctl restart pi-dashboard      # after editing dashboard.py
sudo systemctl disable --now pi-dashboard

# Logs
sudo journalctl -u pi-dashboard -f

# Full-blast fan from the CLI (bypasses dashboard UI)
echo 1   | sudo tee /sys/class/hwmon/hwmon3/pwm1_enable
echo 255 | sudo tee /sys/class/hwmon/hwmon3/pwm1

# What it probes: argent-lite UI launcher (7787), kiosk (7788), ollama
# (11434), argentos-core (8000). Once each listener exposes /healthz the
# HUD will show version + uptime per card instead of just UP/DOWN — see
# deploy/pi-dashboard/HANDOFF.md §"What argent-lite needs to expose".
```

Stdlib-only Python 3, no pip, no venv, no node. Source + hardening
notes live at `deploy/pi-dashboard/` in this repo (vendored from
the original at `/home/jason/scripts/pi-dashboard/`).

## 9c. argent-gateway (ArgentOS WebSocket API)

Optional. Install with `ARGENT_INSTALL_GATEWAY=1 ARGENT_CORE_DIR=/path/to/argentos-core`.

Runs `pnpm run gateway:dev` inside `$ARGENT_CORE_DIR` and listens on
`ws://127.0.0.1:18789`. The React dashboard at :8080 connects here
for all its agent/chat/workflow data. Without the gateway the
dashboard loads but shows "Not connected to Gateway".

```bash
# Start / stop / restart (or do it from pi-dashboard's Argent Lite card)
sudo systemctl enable --now argent-gateway
sudo systemctl restart argent-gateway
sudo systemctl stop argent-gateway

# Watch logs — first start builds TypeScript for ~40s
sudo journalctl -u argent-gateway -f

# Verify port is bound after start
ss -ltn | grep 18789

# Regenerate the auth token (must match VITE_GATEWAY_TOKEN in dashboard/.env.local)
openssl rand -hex 24 | sudo tee -a /etc/default/argent-gateway
sudo systemctl restart argent-gateway
```

**Token pair rule:** the token in `/etc/default/argent-gateway`
(`ARGENT_GATEWAY_TOKEN=...`) and the token in
`$ARGENT_CORE_DIR/dashboard/.env.local`
(`VITE_GATEWAY_TOKEN=...`) **must be identical**. Rotate them
together. On token mismatch, the dashboard's gateway status chip
reads "unauthorized — check token" and chat/RPC is unavailable.

---

## 10. Upgrade

```bash
cd /home/jason/code/argent-lite
git pull
pnpm install --frozen-lockfile
pnpm test && pnpm build
sudo bash scripts/install.sh           # idempotent — overwrites /opt/argent-lite/
sudo systemctl restart argent-lite
journalctl -u argent-lite -f           # watch for errors on the first 30s
```

If the new version breaks, roll back:

```bash
cd /home/jason/code/argent-lite
git log --oneline -10                  # find a known-good sha
git checkout <sha>
pnpm install && pnpm build
sudo bash scripts/install.sh
sudo systemctl restart argent-lite
```

---

## 11. What each subsystem does in one line

| Subsystem | Purpose |
|---|---|
| `src/cli/chat.ts` | The `argent chat` entrypoint. Loops stdin → agent → stdout. |
| `src/cli/index.ts` | The Phase 1 one-shot CLI. `argent-lite "prompt"` → reply. |
| `src/cli/init.ts` | Interactive first-run wizard (cycle-20 in flight). |
| `src/cli/ui.ts` | HTTP launcher on `127.0.0.1:7787` (cycle-20 in flight). |
| `src/integration/runtime.ts` | `bootRuntime()` — the ONLY place that constructs the full stack. |
| `src/agents/` | BaseAgent + MessageBus + RouterAgent + HelloAgent. |
| `src/scheduler/` | Task queue + serial + concurrent schedulers. |
| `src/router/` | ModelRouter + policy + cost + circuit breaker + rate limit + memory log + instrumentation wrappers. |
| `src/providers/` | ollama, groq, openrouter, zai, anthropic, openai, hailo-stub, hailo-live. |
| `src/auth/` | CredentialStore: env backend + AES-256-GCM file backend + rotation. |
| `src/memory/` | SQLite store + retention + encryption + telemetry wrappers. |
| `src/channels/` | cli-stdio, http, file-watch (and future voice-in, voice-out, camera). |
| `src/satellite/` | HTTP client + server + HMAC auth for Pi↔Mac federation. |
| `src/intents/` | Intent router — decides which agent handles which message. |
| `src/obs/` | Structured JSON logger + metrics (counters + histograms) + rotating file sink. |
| `src/config/` | Runtime mode loader + config schema + precedence-based loader. |
| `src/runtime/event-kinds.ts` | Locked event vocabulary: `channel.in`, `channel.out`, `router.in`, `router.out`, `agent.error`. |

---

*Last updated alongside cycle-19 integration (`a8f53e5`). See
`ops/slices/REGISTRY.md` for the full cycle history.*
