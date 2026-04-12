import { describe, expect, it, vi } from "vitest";
import {
  createUiHandlers,
  type BrowserOpener,
  type SystemctlRunner,
} from "../../src/ui/handlers.js";

function makeSystemctl(
  overrides: Partial<SystemctlRunner> = {},
): SystemctlRunner {
  return {
    run: vi.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
    status: vi.fn(async () => ({ running: true, pid: 1234, uptimeSec: 42 })),
    ...overrides,
  };
}

function makeBrowser(overrides: Partial<BrowserOpener> = {}): BrowserOpener {
  return {
    open: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("createUiHandlers", () => {
  it("returns full status shape from injected runner", async () => {
    const systemctl = makeSystemctl();
    const h = createUiHandlers({ systemctl, browser: makeBrowser() });
    const res = await h.status();
    expect(res).toMatchObject({
      ok: true,
      unit: "argent-lite.service",
      running: true,
      pid: 1234,
      uptimeSec: 42,
    });
    expect(systemctl.status).toHaveBeenCalledWith("argent-lite.service");
  });

  it("rejects non-whitelisted units across every action", async () => {
    const systemctl = makeSystemctl();
    const h = createUiHandlers({
      systemctl,
      browser: makeBrowser(),
      unit: "sshd.service",
    });
    for (const res of [
      await h.status(),
      await h.start(),
      await h.stop(),
      await h.restart(),
    ]) {
      expect(res).toEqual({ ok: false, error: "unit not allowed" });
    }
    expect(systemctl.run).not.toHaveBeenCalled();
    expect(systemctl.status).not.toHaveBeenCalled();
  });

  it("accepts both whitelisted unit names", async () => {
    for (const unit of ["argent-lite", "argent-lite.service"]) {
      const systemctl = makeSystemctl();
      const h = createUiHandlers({ systemctl, browser: makeBrowser(), unit });
      const res = await h.start();
      expect(res.ok).toBe(true);
      expect(systemctl.run).toHaveBeenCalledWith("start", unit);
    }
  });

  it("dispatches start/stop/restart to the runner", async () => {
    const systemctl = makeSystemctl();
    const h = createUiHandlers({ systemctl, browser: makeBrowser() });
    await h.start();
    await h.stop();
    await h.restart();
    const calls = (systemctl.run as unknown as { mock: { calls: unknown[][] } })
      .mock.calls;
    expect(calls.map((c) => c[0])).toEqual(["start", "stop", "restart"]);
    expect(calls.every((c) => c[1] === "argent-lite.service")).toBe(true);
  });

  it("marks non-zero exit codes as not ok", async () => {
    const systemctl = makeSystemctl({
      run: vi.fn(async () => ({ code: 3, stdout: "", stderr: "boom" })),
    });
    const h = createUiHandlers({ systemctl, browser: makeBrowser() });
    const res = await h.start();
    expect(res).toMatchObject({ ok: false, code: 3, stderr: "boom" });
  });

  it("propagates runner errors as {ok:false,error}", async () => {
    const systemctl = makeSystemctl({
      run: vi.fn(async () => {
        throw new Error("exec failed");
      }),
    });
    const h = createUiHandlers({ systemctl, browser: makeBrowser() });
    const res = await h.restart();
    expect(res).toEqual({ ok: false, error: "exec failed" });
  });

  it("openDashboard calls browser with default URL", async () => {
    const browser = makeBrowser();
    const h = createUiHandlers({ systemctl: makeSystemctl(), browser });
    const res = await h.openDashboard();
    expect(res.ok).toBe(true);
    expect(browser.open).toHaveBeenCalledWith("http://localhost:5173");
  });

  it("openDashboard respects explicit dashboardUrl", async () => {
    const browser = makeBrowser();
    const h = createUiHandlers({
      systemctl: makeSystemctl(),
      browser,
      dashboardUrl: "http://lite.local:9000",
    });
    const res = await h.openDashboard();
    expect(res).toEqual({ ok: true, url: "http://lite.local:9000" });
    expect(browser.open).toHaveBeenCalledWith("http://lite.local:9000");
  });

  it("openDashboard returns error when opener throws", async () => {
    const browser = makeBrowser({
      open: vi.fn(async () => {
        throw new Error("no display");
      }),
    });
    const h = createUiHandlers({ systemctl: makeSystemctl(), browser });
    const res = await h.openDashboard();
    expect(res).toEqual({ ok: false, error: "no display" });
  });
});
