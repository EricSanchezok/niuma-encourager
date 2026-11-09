import { createDefaultSettings, CURRENT_SCHEMA_VERSION } from "./defaults";
import type { AppSettings } from "./types";
import {
  isGoalName,
  isNonNegativeAmount,
  isRecord,
  isTimeValue,
  isWeekdayList,
  validateSchedule,
} from "./validation";

export function migrateSettings(input: unknown): AppSettings {
  const settings = createDefaultSettings();
  if (!isRecord(input)) return settings;

  if (isNonNegativeAmount(input.monthlySalary))
    settings.monthlySalary = input.monthlySalary;
  if (isRecord(input.goal)) {
    if (isGoalName(input.goal.name))
      settings.goal.name = input.goal.name.trim();
    if (isNonNegativeAmount(input.goal.amount))
      settings.goal.amount = input.goal.amount;
  }
  if (isRecord(input.schedule)) {
    if (isWeekdayList(input.schedule.workDays))
      settings.schedule.workDays = [...input.schedule.workDays];
    const timeFields = [
      "workStart",
      "workEnd",
      "breakStart",
      "breakEnd",
    ] as const;
    for (const field of timeFields) {
      const value = input.schedule[field];
      if (isTimeValue(value)) settings.schedule[field] = value;
    }
    if (!validateSchedule(settings.schedule).valid) {
      const defaults = createDefaultSettings().schedule;
      for (const field of timeFields)
        settings.schedule[field] = defaults[field];
    }
  }
  settings.schemaVersion = CURRENT_SCHEMA_VERSION;
  return settings;
}
