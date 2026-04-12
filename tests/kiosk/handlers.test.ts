import { describe, expect, it, vi } from "vitest";
import { createKioskHandlers } from "../../src/kiosk/handlers.js";

describe("createKioskHandlers", () => {
  it("starts in idle state with the idle status text", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => undefined),
      cancelSpeech: vi.fn(async () => {}),
    });
    const s = await h.status();
    expect(s).toEqual({ state: "idle", statusText: "Tap to talk" });
  });

  it("talkStart moves idle → listening and invokes startCapture", async () => {
    const startCapture = vi.fn(async () => {});
    const h = createKioskHandlers({
      startCapture,
      stopCapture: vi.fn(async () => undefined),
      cancelSpeech: vi.fn(async () => {}),
    });
    const r = await h.talkStart();
    expect(r).toEqual({ ok: true });
    expect(startCapture).toHaveBeenCalledTimes(1);
    expect((await h.status()).state).toBe("listening");
  });

  it("talkStart rejects when not in idle", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => "hi"),
      cancelSpeech: vi.fn(async () => {}),
    });
    await h.talkStart();
    const r = await h.talkStart();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cannot start/);
  });

  it("talkEnd with transcript moves listening → thinking → speaking", async () => {
    const stopCapture = vi.fn(async () => "hello world");
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture,
      cancelSpeech: vi.fn(async () => {}),
    });
    await h.talkStart();
    const r = await h.talkEnd();
    expect(r).toEqual({ ok: true, transcript: "hello world" });
    expect(stopCapture).toHaveBeenCalledTimes(1);
    expect((await h.status()).state).toBe("speaking");
  });

  it("talkEnd with no transcript returns to idle", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => undefined),
      cancelSpeech: vi.fn(async () => {}),
    });
    await h.talkStart();
    const r = await h.talkEnd();
    expect(r).toEqual({ ok: true });
    expect((await h.status()).state).toBe("idle");
  });

  it("talkEnd rejects when not in listening", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => "x"),
      cancelSpeech: vi.fn(async () => {}),
    });
    const r = await h.talkEnd();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cannot end/);
  });

  it("talkStart failure resets state to idle and returns error", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {
        throw new Error("no mic");
      }),
      stopCapture: vi.fn(async () => undefined),
      cancelSpeech: vi.fn(async () => {}),
    });
    const r = await h.talkStart();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no mic");
    expect((await h.status()).state).toBe("idle");
  });

  it("talkEnd failure resets state to idle and returns error", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => {
        throw new Error("stt exploded");
      }),
      cancelSpeech: vi.fn(async () => {}),
    });
    await h.talkStart();
    const r = await h.talkEnd();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("stt exploded");
    expect((await h.status()).state).toBe("idle");
  });

  it("interrupt calls cancelSpeech and returns to idle", async () => {
    const cancelSpeech = vi.fn(async () => {});
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => "hi"),
      cancelSpeech,
    });
    await h.talkStart();
    await h.talkEnd();
    expect((await h.status()).state).toBe("speaking");
    const r = await h.interrupt();
    expect(r).toEqual({ ok: true });
    expect(cancelSpeech).toHaveBeenCalledTimes(1);
    expect((await h.status()).state).toBe("idle");
  });

  it("interrupt propagates errors from cancelSpeech", async () => {
    const h = createKioskHandlers({
      startCapture: vi.fn(async () => {}),
      stopCapture: vi.fn(async () => undefined),
      cancelSpeech: vi.fn(async () => {
        throw new Error("tts stuck");
      }),
    });
    const r = await h.interrupt();
    expect(r).toEqual({ ok: false, error: "tts stuck" });
  });

  it("respects getState override for status reads", async () => {
    const h = createKioskHandlers({
      getState: () => "thinking",
    });
    const s = await h.status();
    expect(s).toEqual({ state: "thinking", statusText: "Thinking..." });
  });
});
