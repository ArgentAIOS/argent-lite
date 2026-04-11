import { afterEach, describe, expect, it } from "vitest";
import { createConnection } from "node:net";
import { hmacSign } from "../../src/satellite/auth.js";
import {
  createRuntimeSatelliteServer,
  type RunningSatelliteServer,
} from "../../src/satellite/runtime-server.js";
import type {
  SatelliteRequest,
  SatelliteResponse,
} from "../../src/satellite/types.js";

const SECRET = "runtime-server-secret";
const HOST = "127.0.0.1";

async function echoHandler(
  req: SatelliteRequest,
): Promise<SatelliteResponse> {
  return { id: req.id, ok: true, payload: req.payload };
}

let running: RunningSatelliteServer | undefined;

afterEach(async () => {
  if (running) {
    await running.stop();
    running = undefined;
  }
});

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: HOST, port });
    sock.once("connect", () => {
      sock.destroy();
      resolve(false);
    });
    sock.once("error", () => {
      resolve(true);
    });
  });
}

function makeRequestBody(): {
  body: string;
  request: SatelliteRequest;
} {
  const request: SatelliteRequest = {
    id: "req-1",
    kind: "ping",
    payload: { hello: "world" },
    ts: 1,
  };
  return { body: JSON.stringify(request), request };
}

function signedHeaders(
  body: string,
  secret: string = SECRET,
): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
    "x-satellite-sig": hmacSign(body, secret),
  };
}

describe("createRuntimeSatelliteServer", () => {
  it("accepts an authenticated request and returns the handler response", async () => {
    running = await createRuntimeSatelliteServer({
      host: HOST,
      secret: SECRET,
      handler: echoHandler,
    });

    const { body, request } = makeRequestBody();
    const res = await fetch(
      `http://${HOST}:${running.port}/v1/satellite/request`,
      {
        method: "POST",
        headers: signedHeaders(body),
        body,
      },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as SatelliteResponse;
    expect(json.id).toBe(request.id);
    expect(json.ok).toBe(true);
    expect(json.payload).toEqual(request.payload);
  });

  it("returns 401 when authorization header is missing", async () => {
    running = await createRuntimeSatelliteServer({
      host: HOST,
      secret: SECRET,
      handler: echoHandler,
    });

    const { body } = makeRequestBody();
    const res = await fetch(
      `http://${HOST}:${running.port}/v1/satellite/request`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      },
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("unauthorized");
  });

  it("returns 401 when the bearer token is wrong", async () => {
    running = await createRuntimeSatelliteServer({
      host: HOST,
      secret: SECRET,
      handler: echoHandler,
    });

    const { body } = makeRequestBody();
    const res = await fetch(
      `http://${HOST}:${running.port}/v1/satellite/request`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret-value-xx",
          "x-satellite-sig": hmacSign(body, "wrong-secret-value-xx"),
        },
        body,
      },
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("unauthorized");
  });

  it("returns 404 on unknown path", async () => {
    running = await createRuntimeSatelliteServer({
      host: HOST,
      secret: SECRET,
      handler: echoHandler,
    });

    const res = await fetch(`http://${HOST}:${running.port}/nope`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON body", async () => {
    running = await createRuntimeSatelliteServer({
      host: HOST,
      secret: SECRET,
      handler: echoHandler,
    });

    const body = "not-json{";
    const res = await fetch(
      `http://${HOST}:${running.port}/v1/satellite/request`,
      {
        method: "POST",
        headers: signedHeaders(body),
        body,
      },
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as SatelliteResponse;
    expect(json.ok).toBe(false);
    expect(typeof json.error).toBe("string");
  });

  it("frees the listening port after stop()", async () => {
    const server = await createRuntimeSatelliteServer({
      host: HOST,
      secret: SECRET,
      handler: echoHandler,
    });
    const port = server.port;
    expect(await portFree(port)).toBe(false);

    await server.stop();

    expect(await portFree(port)).toBe(true);
  });
});
