import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";
import { requireAuth, SatelliteAuthError } from "./auth.js";
import { decodeRequest, encodeResponse } from "./protocol.js";
import {
  SatelliteProtocolError,
  type SatelliteRequest,
  type SatelliteResponse,
} from "./types.js";

export interface SatelliteServerOptions {
  port?: number;
  host?: string;
  secret: string;
  handler: (req: SatelliteRequest) => Promise<SatelliteResponse>;
  now?: () => number;
}

export interface RunningSatelliteServer {
  port: number;
  stop(): Promise<void>;
}

const REQUEST_PATH = "/v1/satellite/request";
const MAX_BODY_BYTES = 1 << 20;

export async function createRuntimeSatelliteServer(
  opts: SatelliteServerOptions,
): Promise<RunningSatelliteServer> {
  if (!opts.secret) {
    throw new Error("createRuntimeSatelliteServer: secret is required");
  }
  if (typeof opts.handler !== "function") {
    throw new Error("createRuntimeSatelliteServer: handler is required");
  }

  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 0;

  const server = createServer((req, res) => {
    handle(req, res, opts).catch((err) => {
      writeJson(res, 500, {
        id: "unknown",
        ok: false,
        error: (err as Error).message,
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("createRuntimeSatelliteServer: failed to bind");
  }

  return {
    port: address.port,
    stop: () => closeServer(server),
  };
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

  const body = await readBody(req);

  try {
    requireAuth({ headers: req.headers, body }, { secret: opts.secret });
  } catch (err) {
    if (err instanceof SatelliteAuthError) {
      writeJson(res, 401, { id: "unknown", ok: false, error: "unauthorized" });
      return;
    }
    throw err;
  }

  let parsed: SatelliteRequest;
  try {
    parsed = decodeRequest(body);
  } catch (err) {
    const message =
      err instanceof SatelliteProtocolError ? err.message : "bad request";
    writeJson(res, 400, { id: "unknown", ok: false, error: message });
    return;
  }

  const response = await opts.handler(parsed);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(encodeResponse(response));
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

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
