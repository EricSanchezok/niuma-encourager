import {
  dateKey,
  getPlannedMinutesForDate,
  getPlannedMinutesForMonth,
  getWorkIntervals,
} from "./calendar";
import type {
  AppSettings,
  CalendarOverrides,
  HolidayCalendar,
  WorkMetrics,
  WorkStatus,
} from "./types";

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function elapsedMinutesForDate(
  date: Date,
  now: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): number {
  const intervals = getWorkIntervals(date, settings, holidays, overrides);
  if (intervals.length === 0) {
    return 0;
  }
  const dayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const nowDayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dateValue = dayStart.getTime();
  const nowValue = nowDayStart.getTime();
  if (dateValue > nowValue) {
    return 0;
  }
  if (dateValue < nowValue) {
    return intervals.reduce(
      (sum, interval) => sum + interval.endMinutes - interval.startMinutes,
      0,
    );
  }

  const currentMinutes = minutesSinceMidnight(now);
  return intervals.reduce((sum, interval) => {
    const elapsed = Math.min(
      Math.max(currentMinutes - interval.startMinutes, 0),
      interval.endMinutes - interval.startMinutes,
    );
    return sum + elapsed;
  }, 0);
}

function getElapsedMinutesForMonth(
  now: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  let total = 0;
  for (let day = 1; day <= now.getDate(); day += 1) {
    total += elapsedMinutesForDate(
      new Date(year, month, day),
      now,
      settings,
      holidays,
      overrides,
    );
  }
  return total;
}

function getStatus(
  now: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides,
): { status: WorkStatus; countdownSeconds: number } {
  const intervals = getWorkIntervals(now, settings, holidays, overrides);
  if (intervals.length === 0) {
    return { status: "rest", countdownSeconds: 0 };
  }

  const currentMinutes = minutesSinceMidnight(now);
  const start = intervals[0].startMinutes;
  const end = intervals[intervals.length - 1].endMinutes;
  if (currentMinutes < start) {
    return {
      status: "before",
      countdownSeconds: Math.max(0, Math.round((start - currentMinutes) * 60)),
    };
  }
  if (currentMinutes >= end) {
    return { status: "after", countdownSeconds: 0 };
  }
  const insideInterval = intervals.some(
    (interval) =>
      currentMinutes >= interval.startMinutes &&
      currentMinutes < interval.endMinutes,
  );
  return {
    status: insideInterval ? "working" : "break",
    countdownSeconds: Math.max(0, Math.round((end - currentMinutes) * 60)),
  };
}

export function calculateWorkMetrics(
  now: Date,
  settings: AppSettings,
  holidays: HolidayCalendar,
  overrides: CalendarOverrides = {},
): WorkMetrics {
  const plannedMinutesToday = getPlannedMinutesForDate(
    now,
    settings,
    holidays,
    overrides,
  );
  const elapsedMinutesToday = elapsedMinutesForDate(
    now,
    now,
    settings,
    holidays,
    overrides,
  );
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const plannedMinutesMonth = getPlannedMinutesForMonth(
    month,
    settings,
    holidays,
    overrides,
  );
  const elapsedMinutesMonth = getElapsedMinutesForMonth(
    now,
    settings,
    holidays,
    overrides,
  );
  const hourlyRate =
    plannedMinutesMonth > 0
      ? settings.monthlySalary / (plannedMinutesMonth / 60)
      : 0;
  const status = getStatus(now, settings, holidays, overrides);
  const earnedToday = Math.min(
    settings.monthlySalary,
    hourlyRate * (elapsedMinutesToday / 60),
  );
  const earnedMonth = Math.min(
    settings.monthlySalary,
    hourlyRate * (elapsedMinutesMonth / 60),
  );
  const goalRemainingHours =
    hourlyRate > 0
      ? Math.max(0, (settings.goal.amount - earnedMonth) / hourlyRate)
      : 0;

  return {
    date: dateKey(now),
    status: status.status,
    plannedMinutesToday,
    elapsedMinutesToday,
    plannedMinutesMonth,
    elapsedMinutesMonth,
    hourlyRate,
    earnedToday,
    earnedMonth,
    earningsPerSecond: status.status === "working" ? hourlyRate / 3600 : 0,
    dayProgress:
      plannedMinutesToday > 0
        ? Math.min(1, elapsedMinutesToday / plannedMinutesToday)
        : 0,
    countdownSeconds: status.countdownSeconds,
    goalRemainingHours,
  };
}
