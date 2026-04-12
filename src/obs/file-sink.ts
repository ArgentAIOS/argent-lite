import {
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  type WriteStream,
} from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { Writable } from "node:stream";

export interface FileSinkOptions {
  path: string;
  maxBytes?: number;
  maxFiles?: number;
  now?: () => number;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;

class FileSink extends Writable {
  private stream: WriteStream;
  private bytes: number;
  private rotating: Promise<void> = Promise.resolve();
  private readonly path: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;

  constructor(opts: FileSinkOptions) {
    super();
    this.path = opts.path;
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
    mkdirSync(dirname(this.path), { recursive: true });
    this.bytes = existsSync(this.path) ? statSync(this.path).size : 0;
    this.stream = createWriteStream(this.path, { flags: "a" });
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    cb: (err?: Error | null) => void,
  ): void {
    const buf =
      typeof chunk === "string"
        ? Buffer.from(chunk, encoding)
        : Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk);

    const writeBuf = (): void => {
      this.bytes += buf.length;
      this.stream.write(buf, (err) => cb(err ?? null));
    };

    if (this.bytes > 0 && this.bytes + buf.length > this.maxBytes) {
      // Serialize rotations so concurrent writes can't race the rename chain.
      this.rotating = this.rotating.then(() => this.rotate());
      this.rotating.then(writeBuf).catch((e) => cb(e as Error));
    } else {
      writeBuf();
    }
  }

  override _final(cb: (err?: Error | null) => void): void {
    this.rotating
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            this.stream.once("close", () => resolve());
            this.stream.once("error", reject);
            this.stream.end();
          }),
      )
      .then(() => cb())
      .catch((e) => cb(e as Error));
  }

  private async rotate(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.once("close", () => resolve());
      this.stream.once("error", reject);
      this.stream.end();
    });

    const last = this.maxFiles - 1;
    if (last >= 1) {
      await safeUnlink(`${this.path}.${last}`);
      for (let i = last - 1; i >= 1; i--) {
        await safeRename(`${this.path}.${i}`, `${this.path}.${i + 1}`);
      }
      await safeRename(this.path, `${this.path}.1`);
    } else {
      await safeUnlink(this.path);
    }

    this.stream = createWriteStream(this.path, { flags: "a" });
    this.bytes = 0;
  }
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

async function safeRename(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function createFileSink(opts: FileSinkOptions): NodeJS.WritableStream {
  return new FileSink(opts);
}
