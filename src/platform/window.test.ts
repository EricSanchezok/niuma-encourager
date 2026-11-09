import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyWindowMode, readWindowMode } from "./window";

const native = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  window: {
    innerSize: vi.fn(),
    scaleFactor: vi.fn(),
    setMinSize: vi.fn(),
    setSize: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: native.isTauri }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => native.window,
}));

beforeEach(() => {
  localStorage.clear();
  native.isTauri.mockReturnValue(true);
  native.window.innerSize.mockReset().mockResolvedValue({
    toLogical: () => ({ width: 460, height: 720 }),
  });
  native.window.scaleFactor.mockReset().mockResolvedValue(2);
  native.window.setMinSize.mockReset().mockResolvedValue(undefined);
  native.window.setSize.mockReset().mockResolvedValue(undefined);
});

describe("native window mode", () => {
  it("restores the previous expanded size after a mini-window visit", async () => {
    await applyWindowMode(true);
    expect(localStorage.getItem("window-mode")).toBe("mini");
    expect(native.window.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 340, height: 168 }),
    );

    await applyWindowMode(false);
    expect(native.window.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 460, height: 720 }),
    );
    expect(localStorage.getItem("window-mode")).toBe("expanded");
  });

  it("restores mini mode on a fresh app session", async () => {
    localStorage.setItem("window-mode", "mini");
    expect(await readWindowMode()).toBe(true);
    expect(native.window.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 340, height: 168 }),
    );
  });

  it("falls back to a usable expanded size if the preference is damaged", async () => {
    localStorage.setItem("expanded-window-size", "invalid JSON");
    await applyWindowMode(false);
    expect(native.window.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 390, height: 568 }),
    );
  });

  it.each([640, 612])(
    "migrates the old %ipx default window and saved expanded size only once",
    async (height) => {
      native.window.innerSize.mockResolvedValue({
        toLogical: () => ({ width: 390, height }),
      });
      localStorage.setItem(
        "expanded-window-size",
        JSON.stringify({ width: 390, height }),
      );
      localStorage.setItem("window-layout-version", "2");
      expect(await readWindowMode()).toBe(false);
      expect(native.window.setSize).toHaveBeenCalledWith(
        expect.objectContaining({ width: 390, height: 568 }),
      );
      expect(JSON.parse(localStorage.getItem("expanded-window-size")!)).toEqual(
        { width: 390, height: 568 },
      );
      expect(localStorage.getItem("window-layout-version")).toBe("3");

      // After upgrading, choosing the former height is a user preference.
      native.window.setSize.mockClear();
      localStorage.setItem(
        "expanded-window-size",
        JSON.stringify({ width: 390, height }),
      );
      await readWindowMode();
      expect(native.window.setSize).not.toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem("expanded-window-size")!)).toEqual(
        { width: 390, height },
      );
    },
  );

  it("preserves custom window dimensions during the layout upgrade", async () => {
    localStorage.setItem(
      "expanded-window-size",
      JSON.stringify({ width: 460, height: 720 }),
    );
    expect(await readWindowMode()).toBe(false);
    expect(native.window.setSize).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("expanded-window-size")!)).toEqual({
      width: 460,
      height: 720,
    });
    expect(localStorage.getItem("window-layout-version")).toBe("3");
    await applyWindowMode(false);
    expect(native.window.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 460, height: 720 }),
    );
  });

  it.each([640, 612])(
    "upgrades the saved %ipx expanded preference while restoring mini mode",
    async (height) => {
      localStorage.setItem("window-mode", "mini");
      localStorage.setItem(
        "expanded-window-size",
        JSON.stringify({ width: 390, height }),
      );
      localStorage.setItem("window-layout-version", "2");
      expect(await readWindowMode()).toBe(true);
      expect(native.window.setSize).toHaveBeenLastCalledWith(
        expect.objectContaining({ width: 340, height: 168 }),
      );
      await applyWindowMode(false);
      expect(native.window.setSize).toHaveBeenLastCalledWith(
        expect.objectContaining({ width: 390, height: 568 }),
      );
    },
  );

  it("does not persist a mode switch when the native resize fails", async () => {
    localStorage.setItem("window-mode", "expanded");
    native.window.setSize.mockRejectedValueOnce(
      new Error("Window unavailable"),
    );
    await expect(applyWindowMode(true)).rejects.toThrow("Window unavailable");
    expect(localStorage.getItem("window-mode")).toBe("expanded");
    expect(native.window.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 460, height: 720 }),
    );
    expect(native.window.setMinSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 390, height: 540 }),
    );
  });

  it("rejects another mode request until the current resize finishes", async () => {
    let finishResize!: () => void;
    native.window.setSize.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResize = resolve;
        }),
    );
    const enteringMini = applyWindowMode(true);
    await vi.waitFor(() =>
      expect(native.window.setSize).toHaveBeenCalledTimes(1),
    );
    try {
      await expect(applyWindowMode(false)).rejects.toThrow(
        /already in progress/,
      );
      expect(localStorage.getItem("window-mode")).toBeNull();
    } finally {
      finishResize();
      await enteringMini;
    }
    expect(localStorage.getItem("window-mode")).toBe("mini");
    await applyWindowMode(false);
    expect(localStorage.getItem("window-mode")).toBe("expanded");
  });

  it("does not resize a browser preview window", async () => {
    native.isTauri.mockReturnValue(false);
    expect(await readWindowMode()).toBe(false);
    await applyWindowMode(true);
    expect(native.window.setSize).not.toHaveBeenCalled();
  });
});
