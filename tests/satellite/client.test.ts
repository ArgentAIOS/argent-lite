import { describe, it, expect, vi } from "vitest";
import { SatelliteClient } from "../../src/satellite/client.js";
import { decodeRequest } from "../../src/satellite/protocol.js";
import type { SatelliteRequest } from "../../src/satellite/types.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("SatelliteClient", () => {
  it("posts to /v1/satellite/request with auth header and json body", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      const decoded = decodeRequest(init?.body as string);
      return jsonResponse({
        id: decoded.id,
        ok: true,
        payload: { pong: true },
      });
    }) as unknown as typeof fetch;

    const client = new SatelliteClient({
      macBaseUrl: "http://mac.local:8080/",
      authToken: "secret-token",
      fetchImpl,
    });

    const ok = await client.ping();
    expect(ok).toBe(true);
    expect(capturedUrl).toBe("http://mac.local:8080/v1/satellite/request");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer secret-token");
    expect(headers["content-type"]).toBe("application/json");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const sent = decodeRequest(capturedInit?.body as string) as SatelliteRequest;
    expect(sent.kind).toBe("ping");
    expect(typeof sent.id).toBe("string");
  });

  it("omits authorization header when no token provided", async () => {
    let headers: Record<string, string> = {};
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      const decoded = decodeRequest(init?.body as string);
      return jsonResponse({ id: decoded.id, ok: true, payload: null });
    }) as unknown as typeof fetch;

    const client = new SatelliteClient({
      macBaseUrl: "http://mac.local:8080",
      fetchImpl,
    });
    await client.ping();
    expect(headers.authorization).toBeUndefined();
  });

  it("retries once on network error then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError("fetch failed");
      }
      const decoded = decodeRequest(init?.body as string);
      return jsonResponse({
        id: decoded.id,
        ok: true,
        payload: { text: "hi" },
      });
    }) as unknown as typeof fetch;

    const client = new SatelliteClient({
      macBaseUrl: "http://mac.local:8080",
      fetchImpl,
    });
    const result = await client.complete({ prompt: "hi" });
    expect(calls).toBe(2);
    expect(result).toEqual({ text: "hi" });
  });

  it("fails after one retry when both attempts error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const client = new SatelliteClient({
      macBaseUrl: "http://mac.local:8080",
      fetchImpl,
    });
    await expect(client.ping()).rejects.toThrow("fetch failed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("aborts via AbortController when the timeout elapses", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("no signal"));
            return;
          }
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;

    const client = new SatelliteClient({
      macBaseUrl: "http://mac.local:8080",
      fetchImpl,
      timeoutMs: 10,
    });

    await expect(client.ping()).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
