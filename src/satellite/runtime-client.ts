import { hmacSign } from "./auth.js";
import { decodeResponse, encodeRequest } from "./protocol.js";
import type { SatelliteRequest, SatelliteResponse } from "./types.js";

export interface SatelliteClientOptions {
  baseUrl: string;
  secret: string;
  timeoutMs?: number;
  retries?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
}

export interface RuntimeSatelliteClient {
  request(req: SatelliteRequest): Promise<SatelliteResponse>;
  ping(): Promise<boolean>;
}

const REQUEST_PATH = "/v1/satellite/request";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;

export function createRuntimeSatelliteClient(
  opts: SatelliteClientOptions,
): RuntimeSatelliteClient {
  if (!opts.baseUrl) {
    throw new Error("createRuntimeSatelliteClient: baseUrl is required");
  }
  if (!opts.secret) {
    throw new Error("createRuntimeSatelliteClient: secret is required");
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const now = opts.now ?? Date.now;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = joinUrl(opts.baseUrl, REQUEST_PATH);

  async function sendOnce(body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.secret}`,
          "x-satellite-sig": hmacSign(body, opts.secret),
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(req: SatelliteRequest): Promise<SatelliteResponse> {
    const body = encodeRequest(req);
    const maxAttempts = retries + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const res = await sendOnce(body);
        if (res.status >= 500 && res.status < 600) {
          lastError = new Error(`satellite client: server error ${res.status}`);
          continue;
        }
        const text = await res.text();
        return decodeResponse(text);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("satellite client: request failed");
  }

  async function ping(): Promise<boolean> {
    const body = encodeRequest({
      id: `ping-${now()}`,
      kind: "ping",
      payload: null,
      ts: now(),
    });
    try {
      const res = await sendOnce(body);
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  return { request, ping };
}

function joinUrl(base: string, path: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
}
