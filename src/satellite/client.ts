import { randomUUID } from "node:crypto";
import { decodeResponse, encodeRequest } from "./protocol.js";
import {
  SatelliteProtocolError,
  type SatelliteRequest,
  type SatelliteRequestKind,
  type SatelliteResponse,
} from "./types.js";

export interface SatelliteClientOptions {
  macBaseUrl: string;
  authToken?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const REQUEST_PATH = "/v1/satellite/request";

export class SatelliteClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: SatelliteClientOptions) {
    this.baseUrl = opts.macBaseUrl.replace(/\/+$/, "");
    this.authToken = opts.authToken;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async ping(): Promise<boolean> {
    const res = await this.send("ping", { at: Date.now() });
    return res.ok;
  }

  async complete(payload: unknown): Promise<unknown> {
    const res = await this.send("completion", payload);
    if (!res.ok) {
      throw new Error(res.error ?? "satellite completion failed");
    }
    return res.payload;
  }

  private async send(
    kind: SatelliteRequestKind,
    payload: unknown,
  ): Promise<SatelliteResponse> {
    const request: SatelliteRequest = {
      id: randomUUID(),
      kind,
      payload,
      ts: Date.now(),
    };
    const body = encodeRequest(request);
    const url = `${this.baseUrl}${REQUEST_PATH}`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          accept: "application/json",
        };
        if (this.authToken) {
          headers.authorization = `Bearer ${this.authToken}`;
        }
        const httpResp = await this.fetchImpl(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        const text = await httpResp.text();
        const decoded = decodeResponse(text);
        if (decoded.id !== request.id) {
          throw new SatelliteProtocolError(
            "response id does not match request id",
          );
        }
        return decoded;
      } catch (err) {
        lastError = err;
        if (err instanceof SatelliteProtocolError) {
          throw err;
        }
        if (attempt === 1) {
          break;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("satellite request failed");
  }
}
