import { request } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  startKioskServer,
  type RunningKioskServer,
} from "../../src/kiosk/server.js";
import type { KioskHandlers } from "../../src/kiosk/handlers.js";

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

function rawSse(
  port: number,
  path: string,
): Promise<{ status: number; contentType: string; firstChunk: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { host: `127.0.0.1:${port}`, accept: "text/event-stream" },
      },
      (res) => {
        const contentType = res.headers["content-type"] ?? "";
        res.setEncoding("utf8");
        let buf = "";
        res.on("data", (chunk: string) => {
          buf += chunk;
          if (buf.includes("event: status")) {
            req.destroy();
            resolvePromise({
              status: res.statusCode ?? 0,
              contentType: String(contentType),
              firstChunk: buf,
            });
          }
        });
      },
    );
    req.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ECONNRESET") return;
      rejectPromise(err);
    });
    req.end();
  });
}

function fakeHandlers(): KioskHandlers {
  return {
    status: async () => ({ state: "idle", statusText: "Tap to talk" }),
    talkStart: async () => ({ ok: true }),
    talkEnd: async () => ({ ok: true, transcript: "hello" }),
    interrupt: async () => ({ ok: true }),
  };
}

let running: RunningKioskServer | null = null;

afterEach(async () => {
  if (running) {
    await running.stop();
    running = null;
  }
});

async function bootServer(): Promise<RunningKioskServer> {
  running = await startKioskServer({
    handlers: fakeHandlers(),
    port: 0,
    tickIntervalMs: 50,
  });
  return running;
}

function baseUrl(s: RunningKioskServer): string {
  return `http://127.0.0.1:${s.port}`;
}

describe("startKioskServer", () => {
  it("serves the kiosk HTML at /", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    const body = await r.text();
    expect(body).toContain("Argent Lite Kiosk");
    expect(body).toContain("id=\"disc\"");
  });

  it("returns current status JSON from /api/status", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/status`);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { state: string; statusText: string };
    expect(j).toEqual({ state: "idle", statusText: "Tap to talk" });
  });

  it("dispatches POST /api/talk/start to the handlers", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/talk/start`, { method: "POST" });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean };
    expect(j).toEqual({ ok: true });
  });

  it("dispatches POST /api/talk/end and returns transcript", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/talk/end`, { method: "POST" });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; transcript?: string };
    expect(j).toEqual({ ok: true, transcript: "hello" });
  });

  it("dispatches POST /api/interrupt to the handlers", async () => {
    const s = await bootServer();
    const r = await fetch(`${baseUrl(s)}/api/interrupt`, { method: "POST" });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean };
    expect(j).toEqual({ ok: true });
  });

  it("SSE /events streams a text/event-stream with an initial status frame", async () => {
    const s = await bootServer();
    const r = await rawSse(s.port, "/events");
    expect(r.status).toBe(200);
    expect(r.contentType).toMatch(/text\/event-stream/);
    expect(r.firstChunk).toContain("event: status");
    expect(r.firstChunk).toContain("\"state\":\"idle\"");
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
