import type { AppSettings } from "./types";

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  monthlySalary: 17_500,
  currency: "CNY",
  schedule: {
    workDays: [1, 2, 3, 4, 5],
    workStart: "10:30",
    workEnd: "19:00",
    breakStart: "12:00",
    breakEnd: "13:30",
  },
  goal: {
    name: "一件冲锋衣",
    amount: 2500,
  },
};

export function createDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    schedule: {
      ...DEFAULT_SETTINGS.schedule,
      workDays: [...DEFAULT_SETTINGS.schedule.workDays],
    },
    goal: { ...DEFAULT_SETTINGS.goal },
  };
}
