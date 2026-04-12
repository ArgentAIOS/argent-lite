<p align="center">
  <img src="https://raw.githubusercontent.com/ArgentAIOS/.github/main/profile/banner.png" alt="ArgentOS" width="100%" />
</p>

<h1 align="center">Argent Lite</h1>

<p align="center">
  <strong>A walk-up AI satellite for your desk. Runs on a Raspberry Pi 5.</strong>
</p>

<p align="center">
  <a href="https://github.com/ArgentAIOS/argent-lite/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/ArgentAIOS/argent-lite/ci.yml?style=for-the-badge" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT" /></a>
  <img src="https://img.shields.io/badge/Node-22%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/badge/TypeScript-Strict%20ESM-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Pi%205-Hailo--10H-c51a4a?style=for-the-badge&logo=raspberrypi&logoColor=white" alt="Raspberry Pi 5" />
</p>

<p align="center">
  <a href="https://argentos.ai">Website</a> &middot;
  <a href="https://github.com/ArgentAIOS/argentos-core">ArgentOS Core</a> &middot;
  <a href="docs/operator-guide.md">Operator Guide</a> &middot;
  <a href="https://discord.gg/argentos">Discord</a>
</p>

---

**Argent Lite** is a Raspberry Pi-native build of [ArgentOS](https://github.com/ArgentAIOS/argentos-core) designed for one thing: a small appliance on your desk that you **walk up to and talk to**. A 7" touchscreen, a mic, a speaker, and a Hailo-10H AI accelerator — all driving a single voice-first interface that's part of your personal AI stack.

It runs as a **satellite** of a Mac-based ArgentOS brain, or **standalone** with cloud fallback. Either way the data stays local, the event loop stays on your hardware, and the UI stays glance-able.

> Think: Amazon Echo Show, except it's yours, it speaks to your agents, and you own every byte.

## Why a "lite"?

Argent Lite is not a port. It's a **ground-up rebuild** for constrained hardware that preserves the ArgentOS mental model while dropping everything that won't survive on a Pi:

| argentos-core (your Mac) | argent-lite (the Pi) |
|---|---|
| PostgreSQL + Redis + Qdrant | **SQLite only** (`node:sqlite`) |
| 18-agent department structure | **1-N light agents** with bounded scheduler |
| React dashboard + full dev toolchain | **Headless-first**, optional kiosk HTML |
| `better-sqlite3` + native compile | **Zero runtime deps** |
| OpenAI/Anthropic/Groq SDKs | **Hand-written OpenAI-compat adapters** |
| OTLP / Prometheus / Datadog | **Local JSONL logs + in-process metrics** |
| Unbounded memory growth | **Retention + encryption + telemetry wrappers** |
| 180-particle AEVP orb at 60 fps | **60 particles, 30 fps** via `PI_PROFILE` |

## What's in Argent Lite

| System | What it does |
|---|---|
| **Model Router** | 4 policies, retry budget, fallback chain. Wrapped by `withMemoryLog`, `instrumentRouter`, `withRateLimit`, `withCircuitBreaker`. |
| **7 Providers** | `ollama`, `hailo`, `groq`, `openrouter`, `anthropic`, `openai`, `zai` (coder + api). Zero third-party SDKs. |
| **Encrypted Credentials** | AES-256-GCM file backend + env backend + rotation wrapper. |
| **Memory Store** | SQLite KV + event log + retention + encryption + telemetry wrappers. |
| **Agents & Scheduler** | `BaseAgent` lifecycle, `MessageBus`, `Scheduler`, `ConcurrentScheduler`, `RouterAgent`, `SatelliteAgent`. |
| **Channels** | CLI stdio, HTTP POST, file-watch, voice-in (Groq Whisper), voice-out (ElevenLabs). |
| **Intent Router** | Priority-ordered handlers that map messages to agents. |
| **Observability** | Structured JSON logger, counters + histograms (p50/p95/p99), rotating file sink. |
| **Runtime Seam** | `bootRuntime()` — single constructor. `argent chat` / `argent daemon` / `argent kiosk`. |
| **Satellite Protocol** | HTTP client + server with mandatory HMAC bearer auth. |
| **Operator HUD** | Vendored Python dashboard on `:9090` — temps, fan, services, start/stop/restart all services. |

## Hardware

| Component | Part | Notes |
|---|---|---|
| **Board** | Raspberry Pi 5 (16 GB) | Active cooling required |
| **Storage** | NVMe via M.2 HAT (≥256 GB) | SD works but wears on sqlite writes |
| **AI Accelerator** | Pi AI HAT+ 2 (Hailo-10H) | Optional; stub provider falls through without it |
| **Display** | 7" Pi Touchscreen (1024×600) | Optional — headless works fine |
| **Audio** | USB mic + USB speaker / 3.5 mm | Any ALSA-visible device |
| **Camera** | Pi Camera Module 3 | Optional, future presence detection |
| **OS** | Debian 12 bookworm (arm64) | Pi OS 64-bit works |
| **Node** | 22+ | Needs `node:sqlite` (22.5+) |

**Cost:** ~$395 USD for the full kit (Pi 5 + NVMe + Hailo + touchscreen + case/fan + audio).

## Quickstart — Pi setup in 15 minutes

### 1. System prerequisites

```bash
sudo apt update && sudo apt install -y git curl build-essential python3 alsa-utils
```

### 2. Install Node 22 + pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
corepack prepare pnpm@10.33.0 --activate
```

### 3. Install Ollama (optional, recommended)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull gemma3:1b    # ~815 MB, fits 16 GB easily
```

### 4. Clone and build

```bash
git clone https://github.com/ArgentAIOS/argent-lite.git
cd argent-lite
pnpm install --frozen-lockfile
pnpm check && pnpm test && pnpm build
```

### 5. First-run setup

```bash
node dist/src/cli/init.js
```

Walks you through: mode (standalone/satellite) → providers → API keys (encrypted) → master key generation → satellite Mac URL (optional).

### 6. Install the systemd service

```bash
sudo bash scripts/install.sh
sudo cp /etc/default/argent-lite.example /etc/default/argent-lite
sudo chmod 0640 /etc/default/argent-lite
sudo nano /etc/default/argent-lite    # set ARGENT_MASTER_KEY
sudo systemctl enable --now argent-lite
```

### 7. Install the operator HUD (strongly recommended)

```bash
sudo ARGENT_INSTALL_DASHBOARD=1 bash scripts/install.sh
sudo systemctl enable --now pi-dashboard
# Open http://<pi-ip>:9090
```

One dashboard to rule them all: temps, fan PWM, CPU/mem/disk, service health, start/stop/restart every ArgentOS service, launch the React desktop dashboard, reserved kiosk slot.

### 8. Verify

```bash
bash scripts/phase3-smoke.sh
# PASS: channel.in=1 channel.out=1 router.out=1
```

See [`docs/operator-guide.md`](docs/operator-guide.md) for the full 275-line reference: day-to-day ops, common fixes, upgrade, uninstall.

## Walk-up satellite

The kiosk is designed for one mental model: **walk up, tap, talk, listen.**

```
┌─────────────────────────────┐
│                             │
│      ●  (orb, pulsing)      │
│                             │
│       "Tap to talk"         │
│                             │
│  ┌───────────────────────┐  │
│  │     TAP TO TALK       │  │
│  └───────────────────────┘  │
│                         ⚙   │
└─────────────────────────────┘
```

**State machine:** `idle → listening → thinking → speaking → idle`

**Voice pipeline:** `arecord` → **Groq Whisper** (~200ms) → bus prompt → `RouterAgent` → provider chain → **ElevenLabs TTS** (~500ms first byte) → `aplay`

Push-to-talk is v1. Wake-word ("Hey Argent") and camera presence detection are planned.

## Architecture

```
src/
├── auth/           Encrypted credentials (env + AES-256-GCM file + rotation)
├── cli/            chat / daemon / ui / kiosk / init entrypoints
├── config/         Mode loader + schema + precedence-based config
├── agents/         BaseAgent, MessageBus, AgentContext, RouterAgent, SatelliteAgent
├── scheduler/      Scheduler, TaskQueue, ConcurrentScheduler
├── router/         ModelRouter + policy + cost + circuit-breaker + rate-limit wrappers
├── providers/      ollama, hailo, groq, openrouter, anthropic, openai, zai
├── memory/         SqliteMemoryStore + retention + encryption + telemetry
├── channels/       cli-stdio, http, file-watch, voice-in, voice-out
├── satellite/      Protocol, HMAC auth, runtime client/server
├── intents/        IntentRouter (priority-ordered handler registry)
├── obs/            Structured JSON logger + metrics + rotating file sink
├── runtime/        Event-kind vocabulary lock (5 kinds, frozen)
├── integration/    bootRuntime() — the ONLY full-stack constructor
├── kiosk/          HTTP server for the 7" touchscreen walk-up interface
└── ui/             HTTP launcher for SSH/desktop debug

deploy/
├── argent-lite.service           Main systemd unit
├── argent-gateway.service        ArgentOS gateway (optional)
├── pi-dashboard/                 Vendored Python HUD + unit + HANDOFF.md
└── *.desktop                     Freedesktop launcher entries

scripts/
├── install.sh / uninstall.sh     Idempotent installer with opt-in gates
├── phase3-smoke.sh               Stub-provider acceptance smoke
├── phase3-ollama-smoke.sh        Real-ollama smoke (load-aware SKIP)
└── hailo-setup.sh / check.sh    Hailo-10H probe + CI smoke
```

## Ports & services

| Port | Bind | Service | Required? |
|---|---|---|---|
| — | — | `argent-lite.service` — the brain | **yes** |
| `127.0.0.1:7788` | loopback | Kiosk (voice + touchscreen) | optional |
| `127.0.0.1:18789` | loopback | ArgentOS Gateway (WS API for React dashboard) | optional |
| `127.0.0.1:11434` | loopback | Ollama | if using local LLM |
| `0.0.0.0:9090` | LAN | Operator HUD (pi-dashboard) | strongly recommended |

All argent services are loopback-only. The HUD is the one exception (binds `0.0.0.0` for LAN access).

## Security

- **Loopback-only by default**
- **HMAC bearer on satellite** — `crypto.timingSafeEqual`, no unauthenticated path
- **AES-256-GCM credential store** — per-file random salt + IV, master key required
- **Memory at-rest encryption** — `withEncryption` wrapper, not greppable
- **Credential rotation** — `withRotation` tracks staleness per provider
- **Unprivileged system user** — only `pi-dashboard` runs as root (fan control)
- **STRIDE threat model** — see [`ops/projects/security-threat-model.md`](ops/projects/security-threat-model.md)

## Development

```bash
pnpm install && pnpm check && pnpm test && pnpm build
```

- Node 22 + pnpm 10
- TypeScript strict, ESM, `isolatedModules`
- vitest for 362+ unit + integration tests
- **Zero runtime dependencies** in package.json
- eslint + prettier

## Project status

| Phase | Status |
|---|---|
| **Phase 1** — headless router + CLI + auth + providers | ✅ live, verified against 4 cloud providers |
| **Phase 2** — agent topology + scheduler + message bus | ✅ complete |
| **Phase 3** — memory + channels + intents + observability + runtime seam | ✅ complete, stub smoke PASS |
| **Phase 4** — deploy + satellite + config + security + CI | ✅ shipped |
| **Phase 5** — walk-up kiosk v0 + voice in/out | 🚧 in flight |
| **Future** — wake-word, camera, Hailo real integration, TLS | planned |

60+ merged PRs. 362+ tests green. 21 cycles of 4-agent autonomous ops.

## Contributing

1. **Star this repo**
2. **Join [Discord](https://discord.gg/argentos)**
3. **File issues** — bugs, feature requests, hardware reports
4. **Submit PRs** — branch `codex/<slice-name>`, merge via threadmaster
5. **Test on your Pi** — the more hardware variants, the better

## Related

- **[ArgentOS Core](https://github.com/ArgentAIOS/argentos-core)** — the full Mac-side brain. Lite federates with it in satellite mode.
- **[pi-dashboard](deploy/pi-dashboard/HANDOFF.md)** — vendored operator HUD.

## Acknowledgments

- **[ArgentOS Core](https://github.com/ArgentAIOS/argentos-core)** by [Jason Brashear](https://jasonbrashear.com) — the design language, the AEVP orb, the agent topology, the Gateway. Lite is the Pi sibling.
- **[Raspberry Pi Foundation](https://www.raspberrypi.com/)** — $100 ARM board that runs an LLM.
- **[Hailo](https://hailo.ai/)** — Hailo-10H accelerator and GenAI Model Zoo.
- **[Groq](https://groq.com/)**, **[OpenRouter](https://openrouter.ai/)**, **[Z.AI](https://z.ai/)**, **[ElevenLabs](https://elevenlabs.io/)** — fast cloud inference that makes a Pi feel instant.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>
    An <a href="https://argentos.ai">ArgentOS</a> project by <a href="https://jasonbrashear.com">Jason Brashear</a>
    &middot; Runs on <a href="https://www.raspberrypi.com/products/raspberry-pi-5/">Raspberry Pi 5</a>
    &middot; Accelerated by <a href="https://hailo.ai/">Hailo-10H</a>
    &middot; Open source (MIT)
  </sub>
</p>

<p align="center">
  <sub>Built in Texas. Runs on your hardware. Answers to you.</sub>
</p>
