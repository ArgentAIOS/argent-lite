import { promises as fs, type PathLike } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import type { AgentMessage } from "../agents/types.js";
import type { Channel, ChannelBus } from "./types.js";

export interface FileWatchChannelOptions {
  agentId: string;
  bus: ChannelBus;
  inPath: string;
  outPath: string;
  replyTo?: string;
  pollMs?: number;
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

export class FileWatchChannel implements Channel {
  readonly id = "file-watch";

  private readonly agentId: string;
  private readonly bus: ChannelBus;
  private readonly inPath: string;
  private readonly outPath: string;
  private readonly replyTo: string;
  private readonly pollMs: number;
  private readonly idPrefix: string;
  private readonly now: () => number;

  private inHandle: FileHandle | null = null;
  private outHandle: FileHandle | null = null;
  private offset = 0;
  private residual = "";
  private timer: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;
  private counter = 0;
  private polling = false;
  private stopped = false;

  constructor(opts: FileWatchChannelOptions) {
    this.agentId = opts.agentId;
    this.bus = opts.bus;
    this.inPath = opts.inPath;
    this.outPath = opts.outPath;
    this.replyTo = opts.replyTo ?? "cli";
    this.pollMs = opts.pollMs ?? 500;
    this.idPrefix = opts.idPrefix ?? "file-watch";
    this.now = opts.now ?? (() => Date.now());
  }

  async start(): Promise<void> {
    if (this.timer !== null || this.inHandle !== null) {
      throw new Error("FileWatchChannel already started");
    }
    this.stopped = false;

    this.inHandle = await fs.open(this.inPath as PathLike, "r");
    this.outHandle = await fs.open(this.outPath as PathLike, "a");
    const stat = await this.inHandle.stat();
    this.offset = stat.size;

    this.unsubscribe = this.bus.subscribe(this.replyTo, (msg) => {
      this.handleReply(msg);
    });

    this.timer = setInterval(() => {
      void this.poll();
    }, this.pollMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.inHandle !== null) {
      await this.inHandle.close();
      this.inHandle = null;
    }
    if (this.outHandle !== null) {
      await this.outHandle.close();
      this.outHandle = null;
    }
    this.residual = "";
    this.offset = 0;
  }

  private async poll(): Promise<void> {
    if (this.polling || this.stopped || this.inHandle === null) {
      return;
    }
    this.polling = true;
    try {
      const stat = await this.inHandle.stat();
      if (stat.size <= this.offset) {
        return;
      }
      const length = stat.size - this.offset;
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await this.inHandle.read(
        buffer,
        0,
        length,
        this.offset,
      );
      this.offset += bytesRead;
      if (bytesRead === 0) {
        return;
      }
      const chunk = this.residual + buffer.subarray(0, bytesRead).toString("utf8");
      const parts = chunk.split("\n");
      this.residual = parts.pop() ?? "";
      for (const line of parts) {
        if (this.stopped) {
          return;
        }
        this.dispatch(line);
      }
    } finally {
      this.polling = false;
    }
  }

  private dispatch(line: string): void {
    this.counter += 1;
    const msg: AgentMessage = {
      id: `${this.idPrefix}-${this.counter}`,
      from: this.replyTo,
      to: this.agentId,
      kind: "prompt",
      payload: { prompt: line },
      ts: this.now(),
    };
    this.bus.send(msg);
  }

  private handleReply(msg: AgentMessage): void {
    if (this.outHandle === null) {
      return;
    }
    if (msg.kind === "completion" && isCompletionPayload(msg.payload)) {
      void this.outHandle.appendFile(`${msg.payload.text}\n`);
      return;
    }
    if (msg.kind === "error" && isErrorPayload(msg.payload)) {
      void this.outHandle.appendFile(`[error] ${msg.payload.message}\n`);
    }
  }
}
