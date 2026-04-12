import { createHmac, timingSafeEqual } from "node:crypto";

export class SatelliteAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SatelliteAuthError";
  }
}

export interface SatelliteAuthRequest {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface RequireAuthOptions {
  secret: string;
}

export function hmacSign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyHmac(
  body: string,
  secret: string,
  signature: string,
): boolean {
  const expected = hmacSign(body, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return timingSafeEqual(a, b);
}

function headerValue(
  headers: SatelliteAuthRequest["headers"],
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (raw === undefined) {
    return undefined;
  }
  return Array.isArray(raw) ? raw[0] : raw;
}

export function requireAuth(
  req: SatelliteAuthRequest,
  opts: RequireAuthOptions,
): void {
  if (!opts.secret) {
    throw new SatelliteAuthError("satellite auth: secret not configured");
  }

  const authHeader = headerValue(req.headers, "authorization");
  if (!authHeader) {
    throw new SatelliteAuthError(
      "satellite auth: missing authorization header",
    );
  }

  const match = /^Bearer (.+)$/.exec(authHeader);
  if (!match) {
    throw new SatelliteAuthError(
      "satellite auth: authorization header must be Bearer <token>",
    );
  }
  const token = match[1];

  const tokenBuf = Buffer.from(token, "utf8");
  const secretBuf = Buffer.from(opts.secret, "utf8");
  if (
    tokenBuf.length !== secretBuf.length ||
    !timingSafeEqual(tokenBuf, secretBuf)
  ) {
    throw new SatelliteAuthError("satellite auth: bearer token mismatch");
  }

  const sig = headerValue(req.headers, "x-satellite-sig");
  if (!sig) {
    throw new SatelliteAuthError(
      "satellite auth: missing x-satellite-sig header",
    );
  }

  if (!verifyHmac(req.body, opts.secret, sig)) {
    throw new SatelliteAuthError("satellite auth: body signature mismatch");
  }
}
