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

No service binds to a public address by default. Everything is
loopback until you edit `/etc/argent-lite/config.json` to change it.

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
sudo systemctl disable --now argent-lite argent-lite-ui argent-lite-kiosk
sudo bash scripts/uninstall.sh
# Leaves ~/.argent-lite/ and /etc/default/argent-lite alone — remove manually if you want.
```

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
