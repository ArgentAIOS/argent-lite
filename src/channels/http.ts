import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";
import type { AgentMessage } from "../agents/types.js";
import type { Channel, ChannelBus } from "./types.js";

export interface HttpChannelOptions {
  agentId: string;
  bus: ChannelBus;
  port?: number;
  host?: string;
  timeoutMs?: number;
  idPrefix?: string;
  now?: () => number;
}

interface PromptBody {
  prompt: string;
}

interface CompletionPayload {
  text: string;
}

interface ErrorPayload {
  message: string;
}

function isPromptBody(value: unknown): value is PromptBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { prompt?: unknown }).prompt === "string"
  );
}

function isCompletionPayload(value: unknown): value is CompletionPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export class HttpChannel implements Channel {
  readonly id = "http";

  private readonly agentId: string;
  private readonly bus: ChannelBus;
  private readonly requestedPort: number;
  private readonly host: string;
  private readonly timeoutMs: number;
  private readonly idPrefix: string;
  private readonly now: () => number;

  private server: Server | null = null;
  private boundPort: number | null = null;
  private counter = 0;

  constructor(opts: HttpChannelOptions) {
    this.agentId = opts.agentId;
    this.bus = opts.bus;
    this.requestedPort = opts.port ?? 0;
    this.host = opts.host ?? "127.0.0.1";
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.idPrefix = opts.idPrefix ?? "http";
    this.now = opts.now ?? (() => Date.now());
  }

  get port(): number {
    if (this.boundPort === null) {
      throw new Error("HttpChannel not started");
    }
    return this.boundPort;
  }

  async start(): Promise<void> {
    if (this.server !== null) {
      throw new Error("HttpChannel already started");
    }

    const server = createServer((req, res) => {
      this.handleRequest(req, res);
    });
    this.server = server;

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => {
        reject(err);
      };
      server.once("error", onError);
      server.listen(this.requestedPort, this.host, () => {
        server.off("error", onError);
        const addr = server.address();
        if (addr === null || typeof addr === "string") {
          reject(new Error("HttpChannel: unexpected server address"));
          return;
        }
        this.boundPort = (addr as AddressInfo).port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (server === null) {
      return;
    }
    this.server = null;
    this.boundPort = null;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err !== undefined && err !== null) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== "POST" || req.url !== "/v1/prompt") {
      this.writeJson(res, 404, { error: "not_found" });
      this.drain(req);
      return;
    }

    this.readBody(req)
      .then((raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          this.writeJson(res, 400, { error: "invalid_json" });
          return;
        }
        if (!isPromptBody(parsed)) {
          this.writeJson(res, 400, { error: "invalid_body" });
          return;
        }
        this.dispatch(parsed.prompt, res);
      })
      .catch(() => {
        this.writeJson(res, 400, { error: "body_read_failed" });
      });
  }

  private dispatch(prompt: string, res: ServerResponse): void {
    this.counter += 1;
    const fromId = `${this.idPrefix}-${this.counter}`;
    const msgId = `${this.idPrefix}-msg-${this.counter}`;

    const controller = new AbortController();
    let settled = false;

    const unsubscribe = this.bus.subscribe(fromId, (reply) => {
      if (settled) {
        return;
      }
      if (reply.kind === "completion" && isCompletionPayload(reply.payload)) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        this.writeJson(res, 200, {
          trace_id: msgId,
          text: reply.payload.text,
        });
        return;
      }
      if (reply.kind === "error" && isErrorPayload(reply.payload)) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        this.writeJson(res, 500, {
          trace_id: msgId,
          error: reply.payload.message,
        });
      }
    });

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      controller.abort();
      unsubscribe();
      this.writeJson(res, 504, { trace_id: msgId, error: "timeout" });
    }, this.timeoutMs);

    controller.signal.addEventListener("abort", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
      }
    });

    const msg: AgentMessage = {
      id: msgId,
      from: fromId,
      to: this.agentId,
      kind: "prompt",
      payload: { prompt },
      ts: this.now(),
    };
    this.bus.send(msg);
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      req.on("error", (err) => {
        reject(err);
      });
    });
  }

  private drain(req: IncomingMessage): void {
    req.on("data", () => {});
    req.on("error", () => {});
  }

  private writeJson(res: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload).toString(),
    });
    res.end(payload);
  }
}
