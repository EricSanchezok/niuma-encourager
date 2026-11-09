import { isTauri } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

export { isTauri };

export const MINI_WINDOW_SIZE = { width: 340, height: 168 };
export const EXPANDED_WINDOW_SIZE = { width: 390, height: 568 };
const MODE_KEY = "window-mode";
const EXPANDED_SIZE_KEY = "expanded-window-size";
const LAYOUT_VERSION_KEY = "window-layout-version";
const LAYOUT_VERSION = "3";
let resizing = false;

function minimumSize(mini: boolean): LogicalSize {
  return new LogicalSize(
    mini ? MINI_WINDOW_SIZE.width : 390,
    mini ? MINI_WINDOW_SIZE.height : 540,
  );
}

function readExpandedSize(): LogicalSize {
  try {
    const size = JSON.parse(localStorage.getItem(EXPANDED_SIZE_KEY) ?? "null");
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
      return new LogicalSize(
        Math.max(390, size.width),
        Math.max(540, size.height),
      );
    }
  } catch {
    // A damaged preference falls back to the default window size.
  }
  return new LogicalSize(
    EXPANDED_WINDOW_SIZE.width,
    EXPANDED_WINDOW_SIZE.height,
  );
}

export async function readWindowMode(): Promise<boolean> {
  if (!isTauri()) return false;
  const window = getCurrentWindow();
  const mini = localStorage.getItem(MODE_KEY) === "mini";
  const migrateLayout =
    localStorage.getItem(LAYOUT_VERSION_KEY) !== LAYOUT_VERSION;
  await window.setMinSize(minimumSize(mini));
  if (migrateLayout) {
    // Upgrade the previous factory size once, while preserving custom dimensions.
    try {
      const saved = JSON.parse(
        localStorage.getItem(EXPANDED_SIZE_KEY) ?? "null",
      );
      if (saved?.width === 390 && [612, 640].includes(saved?.height)) {
        localStorage.setItem(
          EXPANDED_SIZE_KEY,
          JSON.stringify(EXPANDED_WINDOW_SIZE),
        );
      }
    } catch {
      // readExpandedSize handles damaged preferences with the current defaults.
    }
    if (!mini) {
      const size = (await window.innerSize()).toLogical(
        await window.scaleFactor(),
      );
      if (size.width === 390 && [612, 640].includes(size.height)) {
        await window.setSize(
          new LogicalSize(
            EXPANDED_WINDOW_SIZE.width,
            EXPANDED_WINDOW_SIZE.height,
          ),
        );
      }
    }
  }
  if (mini)
    await window.setSize(
      new LogicalSize(MINI_WINDOW_SIZE.width, MINI_WINDOW_SIZE.height),
    );
  if (migrateLayout) localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
  return mini;
}

export async function applyWindowMode(mini: boolean): Promise<void> {
  if (!isTauri()) return;
  if (resizing) throw new Error("A window resize is already in progress");
  resizing = true;
  const window = getCurrentWindow();
  const previousMini = localStorage.getItem(MODE_KEY) === "mini";
  let previousSize: LogicalSize | undefined;
  try {
    previousSize = (await window.innerSize()).toLogical(
      await window.scaleFactor(),
    );
    const nextSize = mini
      ? new LogicalSize(MINI_WINDOW_SIZE.width, MINI_WINDOW_SIZE.height)
      : readExpandedSize();
    await window.setMinSize(minimumSize(mini));
    await window.setSize(nextSize);
    if (mini) {
      localStorage.setItem(
        EXPANDED_SIZE_KEY,
        JSON.stringify({
          width: previousSize.width,
          height: previousSize.height,
        }),
      );
    }
    localStorage.setItem(MODE_KEY, mini ? "mini" : "expanded");
  } catch (error) {
    await window.setMinSize(minimumSize(previousMini)).catch(() => undefined);
    if (previousSize) await window.setSize(previousSize).catch(() => undefined);
    throw error;
  } finally {
    resizing = false;
  }
}

export async function setPinned(value: boolean): Promise<void> {
  if (isTauri()) await getCurrentWindow().setAlwaysOnTop(value);
}

export async function getPinned(): Promise<boolean> {
  return isTauri() ? getCurrentWindow().isAlwaysOnTop() : false;
}

export async function hideWindow(): Promise<void> {
  if (isTauri()) await getCurrentWindow().hide();
}
