export type SatelliteRequestKind = "completion" | "health" | "ping";

export interface SatelliteRequest {
  id: string;
  kind: SatelliteRequestKind;
  payload: unknown;
  ts: number;
}

export interface SatelliteResponse {
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

export class SatelliteProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SatelliteProtocolError";
  }
}
