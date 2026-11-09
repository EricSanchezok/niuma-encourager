import { load } from "@tauri-apps/plugin-store";
import { isTauri } from "../platform/window";
import type { AppSettings, CalendarOverrides } from "../domain/types";

const STORE_PATH = "niuma-encourager.json";
const STATE_KEY = "state";

export type PersistedState = {
  schemaVersion: 1;
  settings?: unknown;
  overrides: CalendarOverrides;
  configured: boolean;
};

function normalizeState(input: unknown): PersistedState {
  const value =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const overrides: CalendarOverrides = {};
  if (value.overrides && typeof value.overrides === "object") {
    for (const [date, kind] of Object.entries(value.overrides)) {
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        (kind === "work" || kind === "rest")
      ) {
        overrides[date] = kind;
      }
    }
  }
  return {
    schemaVersion: 1,
    settings: value.settings,
    overrides,
    configured: value.configured === true,
  };
}

export async function readPersistedState(): Promise<PersistedState> {
  if (isTauri()) {
    const store = await load(STORE_PATH, { autoSave: false });
    const current = await store.get(STATE_KEY);
    if (current) return normalizeState(current);
    const settings = await store.get("settings");
    return normalizeState({
      settings,
      overrides: await store.get("calendarOverrides"),
      configured: Boolean(settings),
    });
  }

  const raw = window.localStorage.getItem(STORE_PATH);
  return normalizeState(raw ? JSON.parse(raw) : undefined);
}

let pendingWrite = Promise.resolve();

export function persistState(
  settings: AppSettings,
  overrides: CalendarOverrides,
  configured = true,
): Promise<void> {
  const state: PersistedState = {
    schemaVersion: 1,
    settings,
    overrides,
    configured,
  };
  const save = async () => {
    if (isTauri()) {
      const store = await load(STORE_PATH, { autoSave: false });
      await store.set(STATE_KEY, state);
      await store.save();
    } else {
      window.localStorage.setItem(STORE_PATH, JSON.stringify(state));
    }
  };
  pendingWrite = pendingWrite.catch(() => undefined).then(save);
  return pendingWrite;
}
