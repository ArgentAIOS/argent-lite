import { createInterface, Interface as ReadlineInterface } from "node:readline";

export interface PromptAskOptions {
  default?: string;
  mask?: boolean;
}

export interface Prompter {
  ask(question: string, opts?: PromptAskOptions): Promise<string>;
  choose<T extends string>(
    question: string,
    options: readonly T[],
    defaultIdx?: number,
  ): Promise<T>;
  multiChoose<T extends string>(
    question: string,
    options: readonly T[],
  ): Promise<T[]>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  print(line: string): void;
}

interface MuteableInterface extends ReadlineInterface {
  _writeToOutput?: (stringToWrite: string) => void;
}

function writeLine(stdout: NodeJS.WritableStream, line: string): void {
  stdout.write(`${line}\n`);
}

function askLine(
  stdin: NodeJS.ReadableStream,
  stdout: NodeJS.WritableStream,
  prompt: string,
  mask: boolean,
): Promise<string> {
  return new Promise((resolve) => {
    const rl: MuteableInterface = createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
    });

    let muted = false;
    const originalWrite = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (stringToWrite: string) => {
      if (!muted) {
        if (originalWrite) {
          originalWrite(stringToWrite);
        } else {
          stdout.write(stringToWrite);
        }
        return;
      }
      for (const ch of stringToWrite) {
        if (ch === "\n" || ch === "\r") {
          stdout.write(ch);
        } else {
          stdout.write("*");
        }
      }
    };

    rl.question(prompt, (answer) => {
      muted = false;
      rl.close();
      resolve(answer);
    });

    if (mask) {
      muted = true;
    }
  });
}

function parseIndexList(input: string, max: number): number[] {
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const out: number[] = [];
  for (const p of parts) {
    const n = Number.parseInt(p, 10);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      throw new Error(`Invalid selection: '${p}' (expected 1..${max})`);
    }
    if (!out.includes(n - 1)) out.push(n - 1);
  }
  return out;
}

export function createReadlinePrompter(
  stdin: NodeJS.ReadableStream = process.stdin,
  stdout: NodeJS.WritableStream = process.stdout,
): Prompter {
  return {
    async ask(question, opts = {}) {
      const suffix = opts.default !== undefined ? ` [${opts.default}]` : "";
      const prompt = `${question}${suffix}: `;
      const raw = await askLine(stdin, stdout, prompt, opts.mask === true);
      const trimmed = raw.trim();
      if (trimmed.length === 0 && opts.default !== undefined) {
        return opts.default;
      }
      return trimmed;
    },

    async choose(question, options, defaultIdx = 0) {
      if (options.length === 0) {
        throw new Error("choose: options list is empty");
      }
      writeLine(stdout, question);
      options.forEach((opt, i) => {
        const marker = i === defaultIdx ? "*" : " ";
        writeLine(stdout, `  ${marker} ${i + 1}) ${opt}`);
      });
      const raw = await askLine(
        stdin,
        stdout,
        `Select 1..${options.length} [${defaultIdx + 1}]: `,
        false,
      );
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return options[defaultIdx] as (typeof options)[number];
      }
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isInteger(n) || n < 1 || n > options.length) {
        throw new Error(
          `Invalid selection: '${trimmed}' (expected 1..${options.length})`,
        );
      }
      return options[n - 1] as (typeof options)[number];
    },

    async multiChoose(question, options) {
      if (options.length === 0) {
        throw new Error("multiChoose: options list is empty");
      }
      writeLine(stdout, question);
      options.forEach((opt, i) => {
        writeLine(stdout, `  ${i + 1}) ${opt}`);
      });
      const raw = await askLine(
        stdin,
        stdout,
        `Select (comma-separated, e.g. 1,3): `,
        false,
      );
      const indices = parseIndexList(raw, options.length);
      return indices.map((i) => options[i] as (typeof options)[number]);
    },

    async confirm(question, defaultYes = true) {
      const suffix = defaultYes ? " [Y/n]" : " [y/N]";
      const raw = await askLine(stdin, stdout, `${question}${suffix}: `, false);
      const trimmed = raw.trim().toLowerCase();
      if (trimmed.length === 0) return defaultYes;
      if (trimmed === "y" || trimmed === "yes") return true;
      if (trimmed === "n" || trimmed === "no") return false;
      return defaultYes;
    },

    print(line) {
      writeLine(stdout, line);
    },
  };
}
