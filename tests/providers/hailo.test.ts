import { describe, it, expect } from "vitest";
import {
  HailoProvider,
  HailoUnavailableError,
} from "../../src/providers/hailo.js";

describe("HailoProvider", () => {
  it("has id 'hailo' and kind 'local'", () => {
    const provider = new HailoProvider({ modelPath: "/models/llama3-8b.hef" });
    expect(provider.id).toBe("hailo");
    expect(provider.kind).toBe("local");
  });

  it("defaults socketPath to /var/run/hailort.sock", () => {
    const provider = new HailoProvider({ modelPath: "/models/x.hef" });
    expect(provider.socketPath).toBe("/var/run/hailort.sock");
  });

  it("respects a custom socketPath", () => {
    const provider = new HailoProvider({
      modelPath: "/models/x.hef",
      socketPath: "/tmp/hailort.sock",
    });
    expect(provider.socketPath).toBe("/tmp/hailort.sock");
  });

  it("complete() throws HailoUnavailableError", async () => {
    const provider = new HailoProvider({ modelPath: "/models/x.hef" });
    await expect(provider.complete({ prompt: "hi" })).rejects.toBeInstanceOf(
      HailoUnavailableError,
    );
    await expect(provider.complete({ prompt: "hi" })).rejects.toThrow(
      /not yet initialized/,
    );
  });

  it("healthCheck() returns false", async () => {
    const provider = new HailoProvider({ modelPath: "/models/x.hef" });
    expect(await provider.healthCheck()).toBe(false);
  });
});
