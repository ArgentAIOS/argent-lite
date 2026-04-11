import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUNTIME_MODE,
  InvalidRuntimeModeError,
  loadMode,
} from "../../src/config/mode.js";

describe("loadMode", () => {
  it("defaults to standalone when ARGENT_MODE is unset", () => {
    expect(loadMode({})).toBe("standalone");
    expect(DEFAULT_RUNTIME_MODE).toBe("standalone");
  });

  it("defaults to standalone when ARGENT_MODE is empty", () => {
    expect(loadMode({ ARGENT_MODE: "" })).toBe("standalone");
  });

  it("round-trips satellite", () => {
    expect(loadMode({ ARGENT_MODE: "satellite" })).toBe("satellite");
  });

  it("normalizes case and whitespace", () => {
    expect(loadMode({ ARGENT_MODE: "  Satellite  " })).toBe("satellite");
    expect(loadMode({ ARGENT_MODE: "STANDALONE" })).toBe("standalone");
  });

  it("throws InvalidRuntimeModeError for unknown values", () => {
    expect(() => loadMode({ ARGENT_MODE: "cloud" })).toThrow(
      InvalidRuntimeModeError,
    );
  });
});
