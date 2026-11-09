import type {
  AppSettings,
  CalendarOverrides,
  HolidayCalendar,
  WorkInterval,
  Weekday,
} from "./types";
import { isTimeValue, validateSchedule } from "./validation";

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseTime(value: string): number {
  if (!isTimeValue(value)) {
    throw new Error(`Invalid time value: ${value}`);
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday;
}

export function isWorkingDay(
  date: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): boolean {
  const key = dateKey(date);
  const override = overrides[key];
  if (override) {
    return override === "work";
  }
  const holiday = holidays[key];
  if (holiday) {
    return holiday.kind === "work";
  }
  return settings.schedule.workDays.includes(weekdayOf(date));
}

export function getWorkIntervals(
  date: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): WorkInterval[] {
  if (!validateSchedule(settings.schedule).valid) {
    throw new Error("Invalid work schedule");
  }
  if (!isWorkingDay(date, settings, holidays, overrides)) {
    return [];
  }

  const start = parseTime(settings.schedule.workStart);
  const end = parseTime(settings.schedule.workEnd);
  const breakStart = parseTime(settings.schedule.breakStart);
  const breakEnd = parseTime(settings.schedule.breakEnd);
  if (breakStart === breakEnd)
    return [{ startMinutes: start, endMinutes: end }];

  const intervals: WorkInterval[] = [];
  if (breakStart > start) {
    intervals.push({ startMinutes: start, endMinutes: breakStart });
  }
  if (breakEnd < end) {
    intervals.push({ startMinutes: breakEnd, endMinutes: end });
  }
  return intervals;
}

export function getPlannedMinutesForMonth(
  month: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): number {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= days; day += 1) {
    total += getWorkIntervals(
      new Date(year, monthIndex, day),
      settings,
      holidays,
      overrides,
    ).reduce(
      (sum, interval) => sum + interval.endMinutes - interval.startMinutes,
      0,
    );
  }
  return total;
}

export function getPlannedMinutesForDate(
  date: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): number {
  return getWorkIntervals(date, settings, holidays, overrides).reduce(
    (sum, interval) => sum + interval.endMinutes - interval.startMinutes,
    0,
  );
}
