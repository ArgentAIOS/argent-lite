export interface SystemctlRunner {
  run(
    cmd: "start" | "stop" | "restart",
    unit: string,
  ): Promise<{ code: number; stdout: string; stderr: string }>;
  status(
    unit: string,
  ): Promise<{ running: boolean; pid?: number; uptimeSec?: number; lastError?: string }>;
}

export interface BrowserOpener {
  open(url: string): Promise<void>;
}

export interface UiHandlersOptions {
  systemctl: SystemctlRunner;
  browser: BrowserOpener;
  unit?: string;
  dashboardUrl?: string;
}

export interface UiHandlers {
  status(): Promise<Record<string, unknown>>;
  start(): Promise<Record<string, unknown>>;
  stop(): Promise<Record<string, unknown>>;
  restart(): Promise<Record<string, unknown>>;
  openDashboard(): Promise<Record<string, unknown>>;
}

const ALLOWED_UNITS = new Set(["argent-lite", "argent-lite.service"]);

function resolveUnit(unit: string | undefined): string | null {
  const candidate = unit ?? "argent-lite.service";
  if (!ALLOWED_UNITS.has(candidate)) return null;
  return candidate;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createUiHandlers(opts: UiHandlersOptions): UiHandlers {
  const unit = resolveUnit(opts.unit);
  const dashboardUrl =
    opts.dashboardUrl ?? process.env.ARGENT_DASHBOARD_URL ?? "http://localhost:5173";

  async function runAction(
    cmd: "start" | "stop" | "restart",
  ): Promise<Record<string, unknown>> {
    if (unit === null) {
      return { ok: false, error: "unit not allowed" };
    }
    try {
      const res = await opts.systemctl.run(cmd, unit);
      return {
        ok: res.code === 0,
        code: res.code,
        stdout: res.stdout,
        stderr: res.stderr,
      };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }

  return {
    async status() {
      if (unit === null) {
        return { ok: false, error: "unit not allowed" };
      }
      try {
        const s = await opts.systemctl.status(unit);
        return {
          ok: true,
          unit,
          running: s.running,
          pid: s.pid,
          uptimeSec: s.uptimeSec,
          lastError: s.lastError,
        };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    start() {
      return runAction("start");
    },
    stop() {
      return runAction("stop");
    },
    restart() {
      return runAction("restart");
    },
    async openDashboard() {
      try {
        await opts.browser.open(dashboardUrl);
        return { ok: true, url: dashboardUrl };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
  };
}
