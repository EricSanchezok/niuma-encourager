import { isTauri } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

export { isTauri };

const MODE_KEY = "window-mode";
const EXPANDED_SIZE_KEY = "expanded-window-size";

function readExpandedSize(): LogicalSize {
  try {
    const size = JSON.parse(localStorage.getItem(EXPANDED_SIZE_KEY) ?? "null");
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
      return new LogicalSize(
        Math.max(390, size.width),
        Math.max(600, size.height),
      );
    }
  } catch {
    // A damaged preference falls back to the default window size.
  }
  return new LogicalSize(390, 640);
}

export async function readWindowMode(): Promise<boolean> {
  if (!isTauri()) return false;
  const window = getCurrentWindow();
  const mini = localStorage.getItem(MODE_KEY) === "mini";
  await window.setMinSize(new LogicalSize(mini ? 340 : 390, mini ? 220 : 600));
  if (mini) await window.setSize(new LogicalSize(340, 220));
  return mini;
}

export async function applyWindowMode(mini: boolean): Promise<void> {
  if (!isTauri()) return;
  const window = getCurrentWindow();
  if (mini) {
    const size = (await window.innerSize()).toLogical(
      await window.scaleFactor(),
    );
    localStorage.setItem(
      EXPANDED_SIZE_KEY,
      JSON.stringify({ width: size.width, height: size.height }),
    );
    await window.setMinSize(new LogicalSize(340, 220));
    await window.setSize(new LogicalSize(340, 220));
  } else {
    await window.setMinSize(new LogicalSize(390, 600));
    await window.setSize(readExpandedSize());
  }
  localStorage.setItem(MODE_KEY, mini ? "mini" : "expanded");
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
