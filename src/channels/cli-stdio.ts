import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { AgentMessage } from "../agents/types.js";
import type { Channel, ChannelBus } from "./types.js";

export interface CliStdioChannelOptions {
  agentId: string;
  bus: ChannelBus;
  stdin?: Readable;
  stdout?: Writable;
  idPrefix?: string;
  now?: () => number;
}

interface CompletionPayload {
  text: string;
}

interface ErrorPayload {
  message: string;
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

export class CliStdioChannel implements Channel {
  readonly id = "cli-stdio";

  private readonly agentId: string;
  private readonly bus: ChannelBus;
  private readonly stdin: Readable;
  private readonly stdout: Writable;
  private readonly idPrefix: string;
  private readonly now: () => number;

  private rl: ReadlineInterface | null = null;
  private unsubscribe: (() => void) | null = null;
  private counter = 0;

  constructor(opts: CliStdioChannelOptions) {
    this.agentId = opts.agentId;
    this.bus = opts.bus;
    this.stdin = opts.stdin ?? process.stdin;
    this.stdout = opts.stdout ?? process.stdout;
    this.idPrefix = opts.idPrefix ?? "cli";
    this.now = opts.now ?? (() => Date.now());
  }

  async start(): Promise<void> {
    if (this.rl !== null || this.unsubscribe !== null) {
      throw new Error("CliStdioChannel already started");
    }

    this.unsubscribe = this.bus.subscribe("cli", (msg) => {
      this.handleReply(msg);
    });

    this.rl = createInterface({ input: this.stdin, crlfDelay: Infinity });
    this.rl.on("line", (line) => {
      this.handleLine(line);
    });
  }

  async stop(): Promise<void> {
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.rl !== null) {
      this.rl.close();
      this.rl = null;
    }
  }

  private handleLine(line: string): void {
    this.counter += 1;
    const msg: AgentMessage = {
      id: `${this.idPrefix}-${this.counter}`,
      from: "cli",
      to: this.agentId,
      kind: "prompt",
      payload: { prompt: line },
      ts: this.now(),
    };
    this.bus.send(msg);
  }

  private handleReply(msg: AgentMessage): void {
    if (msg.kind === "completion" && isCompletionPayload(msg.payload)) {
      this.stdout.write(`${msg.payload.text}\n`);
      return;
    }
    if (msg.kind === "error" && isErrorPayload(msg.payload)) {
      this.stdout.write(`[error] ${msg.payload.message}\n`);
    }
  }
}
