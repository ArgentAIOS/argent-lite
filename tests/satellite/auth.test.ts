import { describe, it, expect } from "vitest";
import {
  SatelliteAuthError,
  hmacSign,
  requireAuth,
  verifyHmac,
} from "../../src/satellite/auth.js";

const SECRET = "test-secret-value";
const BODY = '{"id":"req-1","kind":"ping","payload":{},"ts":1}';

describe("hmacSign", () => {
  it("produces a stable hex digest for fixed body/secret", () => {
    const a = hmacSign(BODY, SECRET);
    const b = hmacSign(BODY, SECRET);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different bodies", () => {
    expect(hmacSign(BODY, SECRET)).not.toBe(hmacSign(BODY + "x", SECRET));
  });
});

describe("verifyHmac", () => {
  it("returns true when signature matches", () => {
    const sig = hmacSign(BODY, SECRET);
    expect(verifyHmac(BODY, SECRET, sig)).toBe(true);
  });

  it("returns false when signature does not match", () => {
    const sig = hmacSign(BODY, SECRET);
    expect(verifyHmac(BODY + "tamper", SECRET, sig)).toBe(false);
  });

  it("returns false when signature length differs (no throw)", () => {
    expect(verifyHmac(BODY, SECRET, "short")).toBe(false);
  });

  it("does not short-circuit on two wrong sigs of same length", () => {
    const wrongA = "a".repeat(64);
    const wrongB = "b".repeat(64);
    expect(verifyHmac(BODY, SECRET, wrongA)).toBe(false);
    expect(verifyHmac(BODY, SECRET, wrongB)).toBe(false);
  });
});

describe("requireAuth", () => {
  function validReq(overrides: {
    body?: string;
    token?: string;
    sig?: string;
    authHeader?: string | undefined;
    sigHeader?: string | undefined;
  } = {}) {
    const body = overrides.body ?? BODY;
    const token = overrides.token ?? SECRET;
    const sig = overrides.sig ?? hmacSign(body, SECRET);
    const headers: Record<string, string | string[] | undefined> = {};
    if (overrides.authHeader !== undefined) {
      headers.authorization = overrides.authHeader;
    } else {
      headers.authorization = `Bearer ${token}`;
    }
    if (overrides.sigHeader !== undefined) {
      headers["x-satellite-sig"] = overrides.sigHeader;
    } else {
      headers["x-satellite-sig"] = sig;
    }
    return { headers, body };
  }

  it("passes on valid bearer token and signature", () => {
    expect(() => requireAuth(validReq(), { secret: SECRET })).not.toThrow();
  });

  it("throws when authorization header is missing", () => {
    const req = validReq({ authHeader: undefined });
    delete req.headers.authorization;
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      SatelliteAuthError,
    );
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      /missing authorization header/,
    );
  });

  it("throws when authorization header is not Bearer <token>", () => {
    const req = validReq({ authHeader: "Basic abc123" });
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      /Bearer <token>/,
    );
  });

  it("throws when bearer token does not match secret", () => {
    const req = validReq({ token: "wrong-secret-value" });
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      /bearer token mismatch/,
    );
  });

  it("throws when bearer token length differs from secret", () => {
    const req = validReq({ token: "short" });
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      SatelliteAuthError,
    );
  });

  it("throws when x-satellite-sig header is missing", () => {
    const req = validReq({ sigHeader: undefined });
    delete req.headers["x-satellite-sig"];
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      /missing x-satellite-sig/,
    );
  });

  it("throws when body has been tampered with", () => {
    const req = validReq();
    req.body = BODY + "x";
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      /body signature mismatch/,
    );
  });

  it("throws when signature is wrong but same length", () => {
    const req = validReq({ sig: "a".repeat(64) });
    expect(() => requireAuth(req, { secret: SECRET })).toThrow(
      /body signature mismatch/,
    );
  });

  it("throws SatelliteAuthError when secret is not configured", () => {
    expect(() => requireAuth(validReq(), { secret: "" })).toThrow(
      /secret not configured/,
    );
  });

  it("timing-safe comparison: two wrong sigs of same length both fail cleanly", () => {
    const reqA = validReq({ sig: "a".repeat(64) });
    const reqB = validReq({ sig: "b".repeat(64) });
    expect(() => requireAuth(reqA, { secret: SECRET })).toThrow(
      SatelliteAuthError,
    );
    expect(() => requireAuth(reqB, { secret: SECRET })).toThrow(
      SatelliteAuthError,
    );
  });
});
