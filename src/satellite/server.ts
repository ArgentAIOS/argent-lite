import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { decodeRequest, encodeResponse } from "./protocol.js";
import {
  SatelliteProtocolError,
  type SatelliteRequest,
  type SatelliteResponse,
} from "./types.js";

export interface SatelliteServerOptions {
  authToken?: string;
}

const REQUEST_PATH = "/v1/satellite/request";
const MAX_BODY_BYTES = 1 << 20;

export function createSatelliteServer(opts: SatelliteServerOptions = {}): Server {
  return createServer((req, res) => {
    handle(req, res, opts).catch((err) => {
      writeJson(res, 500, {
        id: "unknown",
        ok: false,
        error: (err as Error).message,
      });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  opts: SatelliteServerOptions,
): Promise<void> {
  if (req.method !== "POST" || req.url !== REQUEST_PATH) {
    writeJson(res, 404, { id: "unknown", ok: false, error: "not found" });
    return;
  }

  if (opts.authToken) {
    const header = req.headers.authorization;
    if (header !== `Bearer ${opts.authToken}`) {
      writeJson(res, 401, { id: "unknown", ok: false, error: "unauthorized" });
      return;
    }
  }

  const body = await readBody(req);
  let request: SatelliteRequest;
  try {
    request = decodeRequest(body);
  } catch (err) {
    const message =
      err instanceof SatelliteProtocolError ? err.message : "bad request";
    writeJson(res, 400, { id: "unknown", ok: false, error: message });
    return;
  }

  const response = buildCannedResponse(request);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(encodeResponse(response));
}

function buildCannedResponse(request: SatelliteRequest): SatelliteResponse {
  switch (request.kind) {
    case "ping":
      return { id: request.id, ok: true, payload: { pong: true } };
    case "health":
      return {
        id: request.id,
        ok: true,
        payload: { status: "ok", uptime: process.uptime() },
      };
    case "completion":
      return {
        id: request.id,
        ok: true,
        payload: { text: "", note: "satellite stub — no completion yet" },
      };
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function writeJson(
  res: ServerResponse,
  status: number,
  body: SatelliteResponse,
): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
