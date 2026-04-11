import { describe, it, expect } from "vitest";
import {
  decodeRequest,
  decodeResponse,
  encodeRequest,
  encodeResponse,
} from "../../src/satellite/protocol.js";
import {
  SatelliteProtocolError,
  type SatelliteRequest,
  type SatelliteResponse,
} from "../../src/satellite/types.js";

describe("satellite protocol", () => {
  it("round-trips a valid request", () => {
    const req: SatelliteRequest = {
      id: "abc-123",
      kind: "ping",
      payload: { hello: "world" },
      ts: 1_700_000_000_000,
    };
    const encoded = encodeRequest(req);
    const decoded = decodeRequest(encoded);
    expect(decoded).toEqual(req);
  });

  it("round-trips a valid response", () => {
    const res: SatelliteResponse = {
      id: "abc-123",
      ok: true,
      payload: { pong: true },
    };
    expect(decodeResponse(encodeResponse(res))).toEqual(res);
  });

  it("preserves extra fields on decode", () => {
    const raw = JSON.stringify({
      id: "x",
      kind: "health",
      payload: null,
      ts: 1,
      meta: { traceId: "trace-1" },
    });
    const decoded = decodeRequest(raw) as SatelliteRequest & {
      meta?: unknown;
    };
    expect(decoded.id).toBe("x");
    expect(decoded.meta).toEqual({ traceId: "trace-1" });
  });

  it("throws SatelliteProtocolError on malformed json", () => {
    expect(() => decodeRequest("{not json")).toThrow(SatelliteProtocolError);
  });

  it("throws when request is missing required fields", () => {
    expect(() =>
      decodeRequest(JSON.stringify({ id: "x", kind: "ping" })),
    ).toThrow(SatelliteProtocolError);
  });

  it("throws when request.kind is not allowed", () => {
    expect(() =>
      decodeRequest(
        JSON.stringify({ id: "x", kind: "bogus", payload: {}, ts: 1 }),
      ),
    ).toThrow(SatelliteProtocolError);
  });

  it("throws when response.ok is not a boolean", () => {
    expect(() =>
      decodeResponse(JSON.stringify({ id: "x", ok: "yes" })),
    ).toThrow(SatelliteProtocolError);
  });

  it("throws when encoding an invalid request", () => {
    expect(() =>
      encodeRequest({
        id: "",
        kind: "ping",
        payload: null,
        ts: 1,
      } as SatelliteRequest),
    ).toThrow(SatelliteProtocolError);
  });
});
