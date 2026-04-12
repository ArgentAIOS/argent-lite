# pi-dashboard — Handoff for argent-lite integration

A small read-only system dashboard running on the Pi. Shows temps, fan, CPU/mem/disk,
Pi info, apt update alerts, and ArgentOS service health. Fan control is exposed
(PWM + cooling level) so the operator can pin the fan during heavy AI workloads.

Treat this as the "ops heads-up display" for an ArgentOS-lite Pi. It is **not** an
argent-lite component — it is a sibling service that *observes* argent-lite.

## Current state

- **Repo location (dev):** `/home/jason/scripts/pi-dashboard/`
- **Files:**
  - `dashboard.py` — single-file Python 3 stdlib HTTP server (no deps)
  - `static/tailwind.js` — vendored Tailwind Play CDN (441 KB, offline-safe)
- **Service:** `/etc/systemd/system/pi-dashboard.service` (runs as root, `Restart=on-failure`, enabled at boot)
- **Listener:** `0.0.0.0:9090` (bind address is hard-coded; see "Hardening" below)
- **Runtime:** Python 3.11, stdlib only — no pip, no venv, no node
- **Fan control backend:** writes to `/sys/class/hwmon/hwmon3/pwm1{,_enable}` and `/sys/class/thermal/cooling_device0/cur_state` (hence the root requirement)

## What it reads

| Source                                               | Purpose                      |
|------------------------------------------------------|------------------------------|
| `/sys/class/hwmon/hwmon0/temp1_input`                | CPU temp                     |
| `/sys/class/hwmon/hwmon1/temp1_input`                | NVMe temp                    |
| `/sys/class/hwmon/hwmon3/{fan1_input,pwm1,pwm1_enable}` | Fan RPM + PWM control      |
| `/sys/class/thermal/cooling_device0/{cur,max}_state` | Kernel cooling level         |
| `/proc/{stat,meminfo,loadavg,uptime}`                | CPU/mem/load/uptime          |
| `os.statvfs("/")`                                    | Disk usage                   |
| `/proc/device-tree/model`, `/etc/os-release`, `uname`| Pi/OS info                   |
| `apt list --upgradable` (cached, 15 min)             | Update alerts                |
| `SERVICES` list (HTTP / TCP / systemd probes)        | ArgentOS service health      |

## HTTP API

| Method | Path                     | Body / Effect                                    |
|--------|--------------------------|--------------------------------------------------|
| GET    | `/`                      | HTML dashboard                                   |
| GET    | `/static/*`              | Vendored assets (tailwind.js)                    |
| GET    | `/api/stats`             | JSON — everything above, polled every 2 s by UI  |
| POST   | `/api/fan`               | `{"pwm": 0-255}` / `{"auto": true}` / `{"cool": 0-4}` |
| POST   | `/api/updates/refresh`   | Triggers a background `apt list --upgradable`    |

`/api/stats` is the single source of truth. Anything new on the UI should land in
`gather()` first, then get rendered client-side.

## Integration into argent-lite

There are two reasonable shapes; pick the one that matches where argent-lite's build
system is headed.

### Option A — Vendor as an argent-lite-adjacent package (recommended)

Move this into the argent-lite monorepo as a peer of the other `argent-lite-*` packages:

```
code/argent-lite-ops/                 # new package
├── pi-dashboard/
│   ├── dashboard.py
│   ├── static/tailwind.js
│   └── systemd/pi-dashboard.service
├── README.md
└── install.sh
```

`install.sh` should:
1. Copy `pi-dashboard/` → `/opt/argent-lite/pi-dashboard/`
2. Copy `systemd/pi-dashboard.service` → `/etc/systemd/system/` (after rewriting `ExecStart` to the new path)
3. `systemctl daemon-reload && systemctl enable --now pi-dashboard.service`

The install step should run from the same installer that sets up `argent-lite` itself,
gated by an env var like `ARGENT_INSTALL_DASHBOARD=1` so headless deployments can skip it.

### Option B — Separate package, referenced by argent-lite docs

Leave the dashboard in its own repo/tarball and have argent-lite's install guide
point at it as an optional add-on. Lower coupling, but two things to version.

I'd go with A.

## What argent-lite needs to expose for full integration

The dashboard probes each service in `SERVICES`. Today the `argent-lite-*` listeners
are all loopback-only and bind on cycle-gated ports:

| Service               | Port  | Deployed at     | Current probe       |
|-----------------------|-------|-----------------|---------------------|
| argentos-core         | 8000  | now             | HTTP `/health`      |
| ollama                | 11434 | now             | HTTP `/`            |
| argent-desktop-ui     | 7787  | cycle-20        | TCP connect         |
| argent-kiosk/satellite| 7788  | cycle-21+       | TCP connect         |
| satellite-listener    | random HMAC | cycle-20  | (not probed)        |

**Ask from argent-lite:** give each listener a `GET /healthz` that returns `200` with
a small JSON blob, e.g. `{"service":"argent-desktop-ui","version":"0.4.2","uptime_s":123}`.
TCP-connect probes work, but a real health endpoint lets the dashboard show version +
uptime per service, and distinguishes "listening but hung" from "healthy".

Health endpoints should:
- Be unauthenticated (they're loopback-only, and the dashboard has no credentials)
- Avoid any expensive work — no DB calls, no LLM calls
- Respond in under 100 ms

Once those exist, swap the TCP entries in `SERVICES` for `url` entries and the cards
will start showing version strings.

## Security / hardening notes before shipping wider

- **Bind address** is `0.0.0.0:9090`. For a single-operator Pi this is fine behind
  `ufw default deny incoming`. For anything multi-tenant or network-exposed, change
  `HTTPServer(("0.0.0.0", PORT), ...)` to `127.0.0.1` and front with an SSH tunnel
  or Tailscale. There is **no authentication** on the dashboard today.
- **Root privileges.** The service runs as root because writing to
  `/sys/class/hwmon/.../pwm1` requires it. If you want to drop to an unprivileged
  user, the cleanest path is a small setuid helper or a `udev` rule granting a
  dedicated `pi-dashboard` group write access to the specific sysfs paths.
- **Fan control is a real hardware knob.** `pwm=0` stops the fan. Don't wire it
  to anything that can be triggered remotely without auth.
- **No rate limiting.** `apt list --upgradable` is cached at 15 min, but
  `/api/updates/refresh` is not gated — add a token check if exposed.
- **CSRF.** The POST endpoints accept JSON bodies without any origin check. Fine for
  localhost; not fine if proxied.

## Configuration surface

Everything that would reasonably change lives at the top of `dashboard.py`:

```python
PORT = 9090
HWMON_FAN = "/sys/class/hwmon/hwmon3"
COOLING   = "/sys/class/thermal/cooling_device0"
SERVICES  = [ ... ]
```

If argent-lite wants to own dashboard config, the natural move is to read a TOML/JSON
file from `/etc/argent-lite/pi-dashboard.toml` at startup and fall back to these
defaults. Keep the fallback — a broken config file should not take the dashboard down
while the operator is trying to debug *why* the Pi is on fire.

## Things deliberately NOT in scope

- Historical time-series / graphs. This is a live dashboard. For history, ship logs
  to whatever argent-lite is already using (cycle-19 obs-file-sink per the roadmap).
- Alerting. No paging, no email, no webhooks. A DOWN card is the only signal.
- Remote fan control across multiple Pis. One Pi, one dashboard.
- Auth, TLS, multi-user. See "hardening".

## Known gaps / follow-ups

1. The fan sometimes resets to auto after a kernel thermal event — the UI shows the
   current `pwm1_enable` mode chip so the operator can re-pin. A better fix is a
   watchdog loop that re-asserts manual mode periodically; intentionally not added
   because it fights the kernel governor and should be an operator choice.
2. NVMe temp hwmon path (`hwmon1`) is probe-order dependent. On a different Pi image
   the NVMe might land on a different hwmon index. Ideally we'd resolve by `name`
   (`cat /sys/class/hwmon/*/name`) at startup rather than hard-coding indices. Small
   cleanup — not blocking integration.
3. `apt list --upgradable` is Debian-specific. If argent-lite ever runs on a non-apt
   distro, gate the updates card behind a detected package manager.
4. Tailwind is vendored via the Play CDN JS bundle. That's fine — it's self-contained
   — but a "real" build would compile only the classes used into a ~10 KB CSS file
   using the Tailwind standalone CLI. Worth doing if the dashboard ends up on
   resource-constrained Pis (Zero 2W etc.).

## Quick reference commands

```bash
# Status / logs
sudo systemctl status pi-dashboard
sudo journalctl -u pi-dashboard -f

# Restart after editing dashboard.py
sudo systemctl restart pi-dashboard

# Disable
sudo systemctl disable --now pi-dashboard

# Full-blast fan from the CLI (bypasses dashboard)
echo 1   | sudo tee /sys/class/hwmon/hwmon3/pwm1_enable
echo 255 | sudo tee /sys/class/hwmon/hwmon3/pwm1
```

---

**Author's note:** built as a quick operator HUD while bringing AI services up on
a Pi 5. Kept intentionally stdlib-only so it can drop into any argent-lite install
without touching the Node toolchain. If you're extending it, add to `gather()` and
render client-side — don't grow it into a framework.
