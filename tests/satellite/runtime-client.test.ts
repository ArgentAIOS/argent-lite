import { describe, expect, it, vi } from "vitest";
import { hmacSign } from "../../src/satellite/auth.js";
import { createRuntimeSatelliteClient } from "../../src/satellite/runtime-client.js";
import type {
  SatelliteRequest,
  SatelliteResponse,
} from "../../src/satellite/types.js";

const BASE_URL = "http://mac-host:9999";
const SECRET = "runtime-client-secret";

function makeRequest(id = "req-1"): SatelliteRequest {
  return { id, kind: "completion", payload: { prompt: "hi" }, ts: 42 };
}

function okResponse(req: SatelliteRequest): Response {
  const body: SatelliteResponse = {
    id: req.id,
    ok: true,
    payload: { echo: req.payload },
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("createRuntimeSatelliteClient", () => {
  it("round-trips a signed request", async () => {
    const req = makeRequest();
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe(`Bearer ${SECRET}`);
      expect(headers["x-satellite-sig"]).toBe(hmacSign(body, SECRET));
      expect(headers["content-type"]).toBe("application/json");
      return okResponse(req);
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
    });

    const res = await client.request(req);
    expect(res.id).toBe(req.id);
    expect(res.ok).toBe(true);
    expect(res.payload).toEqual({ echo: req.payload });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/v1/satellite/request`);
  });

  it("retries on network error and then succeeds", async () => {
    const req = makeRequest();
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("connect ECONNREFUSED");
      }
      return okResponse(req);
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      retries: 1,
    });

    const res = await client.request(req);
    expect(res.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it("retries on 5xx and then succeeds", async () => {
    const req = makeRequest();
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("boom", { status: 503 });
      }
      return okResponse(req);
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      retries: 2,
    });

    const res = await client.request(req);
    expect(res.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it("gives up after retries exhausted on network error", async () => {
    const req = makeRequest();
    const fetchImpl = vi.fn(async () => {
      throw new Error("ENETUNREACH");
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      retries: 2,
    });

    await expect(client.request(req)).rejects.toThrow(/ENETUNREACH/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("gives up after retries exhausted on 5xx", async () => {
    const req = makeRequest();
    const fetchImpl = vi.fn(
      async () => new Response("err", { status: 500 }),
    ) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      retries: 1,
    });

    await expect(client.request(req)).rejects.toThrow(/server error 500/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("aborts via AbortController on timeout", async () => {
    const req = makeRequest();
    let capturedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      timeoutMs: 5,
      retries: 0,
    });

    await expect(client.request(req)).rejects.toThrow(/aborted/);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("ping() returns true on 2xx", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe(`Bearer ${SECRET}`);
      expect(headers["x-satellite-sig"]).toBeDefined();
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      now: () => 123,
    });

    expect(await client.ping()).toBe(true);
  });

  it("ping() returns false on 5xx", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("err", { status: 500 }),
    ) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl,
      now: () => 123,
    });

    expect(await client.ping()).toBe(false);
  });

  it("strips trailing slash from baseUrl", async () => {
    const req = makeRequest();
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe(`${BASE_URL}/v1/satellite/request`);
      return okResponse(req);
    }) as unknown as typeof fetch;

    const client = createRuntimeSatelliteClient({
      baseUrl: `${BASE_URL}/`,
      secret: SECRET,
      fetchImpl,
    });

    await client.request(req);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
