import { CURRENT_SCHEMA_VERSION } from "./defaults";
import type { ScheduleSettings, Weekday } from "./types";

export type SettingsValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonNegativeAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

export function isWeekdayList(value: unknown): value is Weekday[] {
  return (
    Array.isArray(value) &&
    value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(value).size === value.length
  );
}

export function isTimeValue(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isGoalName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateSchedule(input: unknown): SettingsValidationResult {
  const errors: Record<string, string> = {};
  if (!isRecord(input)) {
    return { valid: false, errors: { schedule: "请设置有效的工作时间" } };
  }
  if (!isWeekdayList(input.workDays)) {
    errors["schedule.workDays"] = "工作日应为不重复的星期选项";
  }
  const timeFields = [
    "workStart",
    "workEnd",
    "breakStart",
    "breakEnd",
  ] as const;
  for (const field of timeFields) {
    if (!isTimeValue(input[field])) {
      errors[`schedule.${field}`] = "请选择有效时间";
    }
  }
  if (timeFields.every((field) => isTimeValue(input[field]))) {
    const schedule = input as ScheduleSettings;
    if (schedule.workEnd <= schedule.workStart) {
      errors["schedule.workEnd"] = "下班时间应晚于上班时间";
    }
    // Equal break times disable lunch, including 00:00–00:00.
    if (schedule.breakStart !== schedule.breakEnd) {
      if (schedule.breakEnd < schedule.breakStart) {
        errors["schedule.breakEnd"] = "午休结束应晚于午休开始";
      } else if (
        schedule.breakStart < schedule.workStart ||
        schedule.breakEnd > schedule.workEnd
      ) {
        errors["schedule.breakEnd"] = "午休应位于工作时段内";
      } else if (
        schedule.breakStart === schedule.workStart &&
        schedule.breakEnd === schedule.workEnd
      ) {
        errors["schedule.breakEnd"] = "请保留有效工作时间";
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateSettings(input: unknown): SettingsValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: { settings: "设置内容无效" } };
  }
  const errors = { ...validateSchedule(input.schedule).errors };
  if (input.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.schemaVersion = "设置版本无效";
  }
  if (!isNonNegativeAmount(input.monthlySalary)) {
    errors.monthlySalary = "月薪应为有效的非负金额";
  }
  if (input.currency !== "CNY") {
    errors.currency = "请选择支持的币种";
  }
  if (!isRecord(input.goal)) {
    errors.goal = "请设置有效的激励目标";
  } else {
    if (!isGoalName(input.goal.name)) {
      errors["goal.name"] = "请填写激励事项";
    }
    if (!isNonNegativeAmount(input.goal.amount)) {
      errors["goal.amount"] = "目标应为有效的非负金额";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
