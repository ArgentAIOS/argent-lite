import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { UiHandlers } from "./handlers.js";

export interface StartUiServerOptions {
  handlers: UiHandlers;
  port?: number;
  host?: string;
  indexHtmlPath?: string;
}

export interface RunningUiServer {
  port: number;
  stop(): Promise<void>;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 7787;

function resolveDefaultIndexHtmlPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "index.html");
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

export async function startUiServer(
  opts: StartUiServerOptions,
): Promise<RunningUiServer> {
  const host = opts.host ?? DEFAULT_HOST;
  const requestedPort = opts.port ?? DEFAULT_PORT;
  const indexPath = opts.indexHtmlPath ?? resolveDefaultIndexHtmlPath();
  const indexHtml = await readFile(indexPath);

  let listeningPort = requestedPort;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { ok: false, error: message });
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
      sendJson(res, 200, await opts.handlers.status());
      return;
    }

    if (method === "POST" && url === "/api/start") {
      sendJson(res, 200, await opts.handlers.start());
      return;
    }

    if (method === "POST" && url === "/api/stop") {
      sendJson(res, 200, await opts.handlers.stop());
      return;
    }

    if (method === "POST" && url === "/api/restart") {
      sendJson(res, 200, await opts.handlers.restart());
      return;
    }

    if (method === "POST" && url === "/api/open-dashboard") {
      sendJson(res, 200, await opts.handlers.openDashboard());
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
      return new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((err) => {
          if (err) rejectPromise(err);
          else resolvePromise();
        });
      });
    },
  };
}
