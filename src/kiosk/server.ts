import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { KioskHandlers } from "./handlers.js";

export interface StartKioskServerOptions {
  handlers: KioskHandlers;
  port?: number;
  host?: string;
  indexHtmlPath?: string;
  /** SSE tick interval in ms. Default 500. */
  tickIntervalMs?: number;
}

export interface RunningKioskServer {
  port: number;
  stop(): Promise<void>;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 7788;
const DEFAULT_TICK_MS = 500;

async function resolveDefaultIndexHtmlPath(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "index.html"),
    resolve(here, "..", "..", "..", "src", "kiosk", "index.html"),
  ];
  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return candidates[0];
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload).toString(),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function sendText(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
): void {
  const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": buf.length.toString(),
    "cache-control": "no-store",
  });
  res.end(buf);
}

function hostHeaderAllowed(
  hostHeader: string | undefined,
  port: number,
): boolean {
  if (!hostHeader) return false;
  return (
    hostHeader === `127.0.0.1:${port}` || hostHeader === `localhost:${port}`
  );
}

export async function startKioskServer(
  opts: StartKioskServerOptions,
): Promise<RunningKioskServer> {
  const host = opts.host ?? DEFAULT_HOST;
  const requestedPort = opts.port ?? DEFAULT_PORT;
  const tickMs = opts.tickIntervalMs ?? DEFAULT_TICK_MS;
  const indexPath = opts.indexHtmlPath ?? (await resolveDefaultIndexHtmlPath());
  const indexHtml = await readFile(indexPath);

  let listeningPort = requestedPort;
  const sseClients = new Set<ServerResponse>();
  let tickTimer: NodeJS.Timeout | null = null;

  async function writeTick(): Promise<void> {
    if (sseClients.size === 0) return;
    const status = await opts.handlers.status();
    const frame = `event: status\ndata: ${JSON.stringify(status)}\n\n`;
    for (const client of sseClients) {
      client.write(frame);
    }
  }

  function ensureTicker(): void {
    if (tickTimer !== null) return;
    tickTimer = setInterval(() => {
      void writeTick().catch(() => {
        /* ignore */
      });
    }, tickMs);
    tickTimer.unref();
  }

  function stopTicker(): void {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: message });
      } else {
        res.end();
      }
    });
  });

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (!hostHeaderAllowed(req.headers.host, listeningPort)) {
      sendJson(res, 403, { ok: false, error: "host header not allowed" });
      return;
    }

    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (method === "GET" && (url === "/" || url === "/index.html")) {
      sendText(res, 200, "text/html; charset=utf-8", indexHtml);
      return;
    }

    if (method === "GET" && url === "/api/status") {
      sendJson(res, 200, { ...(await opts.handlers.status()) });
      return;
    }

    if (method === "GET" && url === "/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      });
      res.write(": connected\n\n");
      const initial = await opts.handlers.status();
      res.write(`event: status\ndata: ${JSON.stringify(initial)}\n\n`);
      sseClients.add(res);
      ensureTicker();
      req.on("close", () => {
        sseClients.delete(res);
        if (sseClients.size === 0) stopTicker();
      });
      return;
    }

    if (method === "POST" && url === "/api/talk/start") {
      sendJson(res, 200, { ...(await opts.handlers.talkStart()) });
      return;
    }

    if (method === "POST" && url === "/api/talk/end") {
      sendJson(res, 200, { ...(await opts.handlers.talkEnd()) });
      return;
    }

    if (method === "POST" && url === "/api/interrupt") {
      sendJson(res, 200, { ...(await opts.handlers.interrupt()) });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(requestedPort, host, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        listeningPort = addr.port;
      }
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  return {
    port: listeningPort,
    stop() {
      stopTicker();
      for (const client of sseClients) {
        client.end();
      }
      sseClients.clear();
      return new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((err) => {
          if (err) rejectPromise(err);
          else resolvePromise();
        });
      });
    },
  };
}
