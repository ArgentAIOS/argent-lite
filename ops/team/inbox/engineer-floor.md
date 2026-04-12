# Task 020 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: ui-launcher-impl
Branch: codex/ui-launcher-impl (worktree /home/jason/code/argent-lite-floor)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-floor.md
- src/ui/server.ts
- src/ui/handlers.ts
- src/ui/index.html
- src/ui/index.ts
- tests/ui/handlers.test.ts
- tests/ui/server.test.ts
- deploy/argent-lite-launcher.desktop
- src/cli/ui.ts

## Goal

HTTP launcher served by argent-lite on `127.0.0.1:7787` with 4
actions: Start / Stop / Restart / Open Dashboard.

### 1. `src/ui/handlers.ts` — pure handler logic

```ts
export interface SystemctlRunner {
  run(cmd: "start" | "stop" | "restart", unit: string): Promise<{ code: number; stdout: string; stderr: string }>;
  status(unit: string): Promise<{ running: boolean; pid?: number; uptimeSec?: number; lastError?: string }>;
}

export interface BrowserOpener {
  open(url: string): Promise<void>;
}

export interface UiHandlersOptions {
  systemctl: SystemctlRunner;
  browser: BrowserOpener;
  unit?: string;            // default "argent-lite.service"
  dashboardUrl?: string;    // default process.env.ARGENT_DASHBOARD_URL || "http://localhost:5173"
}

export interface UiHandlers {
  status(): Promise<Record<string, unknown>>;
  start(): Promise<Record<string, unknown>>;
  stop(): Promise<Record<string, unknown>>;
  restart(): Promise<Record<string, unknown>>;
  openDashboard(): Promise<Record<string, unknown>>;
}
export function createUiHandlers(opts: UiHandlersOptions): UiHandlers;
```

Unit whitelist: only accept `"argent-lite"` or `"argent-lite.service"`
(case-sensitive). Reject anything else with `{ok: false, error: "unit not allowed"}`.
Never shell-interpolate — pass args as array to `execFile`.

### 2. `src/ui/server.ts` — HTTP glue

- `startUiServer(opts: { handlers: UiHandlers; port?: number; host?: string }): Promise<{port: number; stop(): Promise<void>}>`
- Uses `node:http.createServer`. Default host `"127.0.0.1"`, port `7787`.
- Routes:
  - `GET /` → `index.html` (read at startup, cached)
  - `GET /api/status` → JSON
  - `POST /api/start` → JSON
  - `POST /api/stop` → JSON
  - `POST /api/restart` → JSON
  - `POST /api/open-dashboard` → JSON
  - anything else → 404
- **Security:** reject any request whose `host` header is not
  `127.0.0.1:{port}` or `localhost:{port}`. 403 on mismatch.
- CORS: none (loopback only).

### 3. `src/ui/index.html` — single-file UI

Plain HTML + inline CSS + inline vanilla JS. No framework, no build
step. 4 buttons. Calls `/api/*` via fetch. Updates status every 3s.
Tasteful dark theme, ~150 lines total. No external fonts, no external
assets — must work fully offline on the Pi.

### 4. `src/ui/index.ts` — re-exports.

### 5. `src/cli/ui.ts` — entrypoint

```ts
export async function runUi(argv: string[] = process.argv.slice(2)): Promise<number>;
```

- Constructs real `SystemctlRunner` (child_process.execFile) and
  `BrowserOpener` (spawn `xdg-open`).
- Calls `createUiHandlers` + `startUiServer`.
- Prints `listening on http://127.0.0.1:7787`.
- Waits for SIGINT, then `server.stop()`.

### 6. `deploy/argent-lite-launcher.desktop`

Freedesktop entry:
```
[Desktop Entry]
Type=Application
Name=Argent Lite Launcher
Comment=Control Argent Lite service
Exec=xdg-open http://127.0.0.1:7787
Icon=applications-system
Terminal=false
Categories=System;Utility;
```

### 7. Tests

- `tests/ui/handlers.test.ts`: inject fake SystemctlRunner + BrowserOpener,
  verify whitelist rejection, status shape, action dispatch, error
  propagation.
- `tests/ui/server.test.ts`: start on port 0, fetch `/`, fetch `/api/status`,
  POST `/api/start` with fake handlers, assert host-header rejection
  (403 when `host: evil.com`).

## Constraints

- Node built-ins only. No express, no frameworks.
- Do NOT touch `bootRuntime` or any other subsystem.
- Strict TS, no `any`.

Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
