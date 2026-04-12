import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileSink } from "../../src/obs/file-sink.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "argent-file-sink-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function endSink(sink: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    sink.once("error", reject);
    sink.end(() => resolve());
  });
}

describe("createFileSink", () => {
  it("writes records to the configured file", async () => {
    const path = join(dir, "app.log");
    const sink = createFileSink({ path });
    sink.write("hello\n");
    sink.write("world\n");
    await endSink(sink);
    expect(readFileSync(path, "utf8")).toBe("hello\nworld\n");
  });

  it("rotates to path.1 when maxBytes exceeded", async () => {
    const path = join(dir, "rot.log");
    const sink = createFileSink({ path, maxBytes: 20 });
    const a = "A".repeat(15) + "\n"; // 16 bytes — fits
    const b = "B".repeat(15) + "\n"; // 16 bytes — triggers rotation
    sink.write(a);
    sink.write(b);
    await endSink(sink);

    expect(existsSync(`${path}.1`)).toBe(true);
    expect(readFileSync(`${path}.1`, "utf8")).toBe(a);
    expect(readFileSync(path, "utf8")).toBe(b);
  });

  it("caps retained files at maxFiles across repeated rotations", async () => {
    const path = join(dir, "cap.log");
    const sink = createFileSink({ path, maxBytes: 5, maxFiles: 3 });
    const rows = ["row0xxxxx\n", "row1xxxxx\n", "row2xxxxx\n", "row3xxxxx\n", "row4xxxxx\n", "row5xxxxx\n"];
    for (const r of rows) sink.write(r);
    await endSink(sink);

    expect(readFileSync(path, "utf8")).toBe("row5xxxxx\n");
    expect(readFileSync(`${path}.1`, "utf8")).toBe("row4xxxxx\n");
    expect(readFileSync(`${path}.2`, "utf8")).toBe("row3xxxxx\n");
    expect(existsSync(`${path}.3`)).toBe(false);
    expect(existsSync(`${path}.4`)).toBe(false);
  });

  it("propagates close via end() callback", async () => {
    const path = join(dir, "close.log");
    const sink = createFileSink({ path });
    sink.write("bye\n");
    let closed = false;
    await new Promise<void>((resolve, reject) => {
      sink.once("error", reject);
      sink.end(() => {
        closed = true;
        resolve();
      });
    });
    expect(closed).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("bye\n");
  });
});
