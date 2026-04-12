import {
  SatelliteProtocolError,
  type SatelliteRequest,
  type SatelliteRequestKind,
  type SatelliteResponse,
} from "./types.js";

const REQUEST_KINDS: readonly SatelliteRequestKind[] = [
  "completion",
  "health",
  "ping",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new SatelliteProtocolError(
      `invalid json: ${(err as Error).message}`,
    );
  }
}

export function encodeRequest(req: SatelliteRequest): string {
  validateRequest(req);
  return JSON.stringify(req);
}

export function decodeRequest(raw: string): SatelliteRequest {
  const parsed = parseJson(raw);
  if (!isPlainObject(parsed)) {
    throw new SatelliteProtocolError("request must be an object");
  }
  validateRequest(parsed);
  return parsed as unknown as SatelliteRequest;
}

export function encodeResponse(res: SatelliteResponse): string {
  validateResponse(res);
  return JSON.stringify(res);
}

export function decodeResponse(raw: string): SatelliteResponse {
  const parsed = parseJson(raw);
  if (!isPlainObject(parsed)) {
    throw new SatelliteProtocolError("response must be an object");
  }
  validateResponse(parsed);
  return parsed as unknown as SatelliteResponse;
}

function validateRequest(value: Record<string, unknown> | SatelliteRequest): void {
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id.length === 0) {
    throw new SatelliteProtocolError("request.id must be a non-empty string");
  }
  if (
    typeof v.kind !== "string" ||
    !REQUEST_KINDS.includes(v.kind as SatelliteRequestKind)
  ) {
    throw new SatelliteProtocolError(
      `request.kind must be one of ${REQUEST_KINDS.join(", ")}`,
    );
  }
  if (typeof v.ts !== "number" || !Number.isFinite(v.ts)) {
    throw new SatelliteProtocolError("request.ts must be a finite number");
  }
  if (!("payload" in v)) {
    throw new SatelliteProtocolError("request.payload is required");
  }
}

function validateResponse(
  value: Record<string, unknown> | SatelliteResponse,
): void {
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id.length === 0) {
    throw new SatelliteProtocolError("response.id must be a non-empty string");
  }
  if (typeof v.ok !== "boolean") {
    throw new SatelliteProtocolError("response.ok must be a boolean");
  }
  if ("error" in v && v.error !== undefined && typeof v.error !== "string") {
    throw new SatelliteProtocolError("response.error must be a string");
  }
}
