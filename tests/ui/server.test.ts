import { request } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { startUiServer, type RunningUiServer } from "../../src/ui/server.js";
import type { UiHandlers } from "../../src/ui/handlers.js";

function rawRequest(
  port: number,
  path: string,
  headers: Record<string, string>,
  method = "GET",
): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request(
      { host: "127.0.0.1", port, path, method, headers },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () =>
          resolvePromise({ status: res.statusCode ?? 0, body }),
        );
      },
    );
    req.on("error", rejectPromise);
    req.end();
  });
}

function fakeHandlers(): UiHandlers {
  return {
    status: async () => ({ ok: true, unit: "argent-lite.service", running: true }),
    start: async () => ({ ok: true, code: 0 }),
    stop: async () => ({ ok: true, code: 0 }),
    restart: async () => ({ ok: true, code: 0 }),
    openDashboard: async () => ({ ok: true, url: "http://localhost:5173" }),
  };
}

let running: RunningUiServer | null = null;

afterEach(async () => {
  if (running) {
    await running.stop();
    running = null;
  }
});

async function bootServer(): Promise<RunningUiServer> {
  running = await startUiServer({ handlers: fakeHandlers(), port: 0 });
  return running;
}

function baseUrl(s: RunningUiServer): string {
  return `http://127.0.0.1:${s.port}`;
}

describe("startUiServer", () => {
  it("serves the HTML index at /", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    const body = await r.text();
    expect(body).toContain("Argent Lite Launcher");
  });

  it("returns JSON from /api/status", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/status`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ ok: true, running: true });
  });

  it("dispatches POST /api/start to the handlers", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/start`, { method: "POST" });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toEqual({ ok: true, code: 0 });
  });

  it("rejects requests with a non-loopback host header (403)", async () => {
    const s = await bootServer();
    const r = await rawRequest(s.port, "/api/status", { host: "evil.com" });
    expect(r.status).toBe(403);
    const j = JSON.parse(r.body) as { ok: boolean };
    expect(j.ok).toBe(false);
  });

  it("404s unknown routes", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/nope`);
    expect(r.status).toBe(404);
  });
});
