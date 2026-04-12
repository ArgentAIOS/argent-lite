import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import {
  createReadlinePrompter,
  type Prompter,
} from "../../src/cli/init-prompts.js";

interface Harness {
  prompter: Prompter;
  stdin: PassThrough;
  output: string[];
  write: (line: string) => void;
}

function makeHarness(): Harness {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const output: string[] = [];
  stdout.on("data", (chunk: Buffer) => {
    output.push(chunk.toString("utf8"));
  });
  const prompter = createReadlinePrompter(stdin, stdout);
  return {
    prompter,
    stdin,
    output,
    write: (line: string) => {
      stdin.write(`${line}\n`);
    },
  };
}

describe("createReadlinePrompter", () => {
  it("ask returns trimmed user input", async () => {
    const h = makeHarness();
    const p = h.prompter.ask("Name?");
    h.write("  alice  ");
    await expect(p).resolves.toBe("alice");
  });

  it("ask returns default when input is empty", async () => {
    const h = makeHarness();
    const p = h.prompter.ask("Host?", { default: "localhost" });
    h.write("");
    await expect(p).resolves.toBe("localhost");
  });

  it("ask masks output when mask: true", async () => {
    const h = makeHarness();
    const p = h.prompter.ask("Secret?", { mask: true });
    h.write("hunter2");
    const answer = await p;
    expect(answer).toBe("hunter2");
    const full = h.output.join("");
    expect(full).not.toContain("hunter2");
    expect(full).toContain("*");
  });

  it("choose returns the selected option", async () => {
    const h = makeHarness();
    const p = h.prompter.choose("Mode?", ["standalone", "satellite"] as const);
    h.write("2");
    await expect(p).resolves.toBe("satellite");
  });

  it("choose returns default on empty input", async () => {
    const h = makeHarness();
    const p = h.prompter.choose(
      "Mode?",
      ["standalone", "satellite"] as const,
      0,
    );
    h.write("");
    await expect(p).resolves.toBe("standalone");
  });

  it("choose throws on out-of-range input", async () => {
    const h = makeHarness();
    const p = h.prompter.choose("Mode?", ["a", "b"] as const);
    h.write("9");
    await expect(p).rejects.toThrow(/Invalid selection/);
  });

  it("multiChoose parses comma-separated indices", async () => {
    const h = makeHarness();
    const p = h.prompter.multiChoose(
      "Providers?",
      ["ollama", "anthropic", "openai", "groq"] as const,
    );
    h.write("1,3");
    await expect(p).resolves.toEqual(["ollama", "openai"]);
  });

  it("multiChoose deduplicates repeated indices", async () => {
    const h = makeHarness();
    const p = h.prompter.multiChoose(
      "Providers?",
      ["a", "b", "c"] as const,
    );
    h.write("2,2,1");
    await expect(p).resolves.toEqual(["b", "a"]);
  });

  it("confirm defaults to Yes on empty input when defaultYes=true", async () => {
    const h = makeHarness();
    const p = h.prompter.confirm("ok?", true);
    h.write("");
    await expect(p).resolves.toBe(true);
  });

  it("confirm accepts 'n' for no", async () => {
    const h = makeHarness();
    const p = h.prompter.confirm("ok?", true);
    h.write("n");
    await expect(p).resolves.toBe(false);
  });

  it("confirm accepts 'yes' for yes", async () => {
    const h = makeHarness();
    const p = h.prompter.confirm("ok?", false);
    h.write("yes");
    await expect(p).resolves.toBe(true);
  });

  it("print writes a line with a trailing newline", () => {
    const h = makeHarness();
    h.prompter.print("hello");
    const full = h.output.join("");
    expect(full).toBe("hello\n");
  });
});
