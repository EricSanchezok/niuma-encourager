import { describe, expect, it } from "vitest";
import { calculateWorkMetrics } from "./calculator";
import { getWorkIntervals, isWorkingDay } from "./calendar";
import { createDefaultSettings } from "./defaults";
import type { HolidayCalendar } from "./types";

const baseSettings = createDefaultSettings();
const noHolidays: HolidayCalendar = {};

function at(value: string): Date {
  return new Date(`2025-11-05T${value}:00`);
}

describe("calendar precedence", () => {
  it("uses explicit date overrides before holiday data and weekly schedule", () => {
    const holiday: HolidayCalendar = {
      "2025-11-05": { kind: "rest", name: "测试节假日" },
    };
    expect(isWorkingDay(at("10:00"), baseSettings, holiday, {})).toBe(false);
    expect(
      isWorkingDay(at("10:00"), baseSettings, holiday, {
        "2025-11-05": "work",
      }),
    ).toBe(true);
    expect(
      isWorkingDay(at("10:00"), baseSettings, {}, { "2025-11-05": "rest" }),
    ).toBe(false);
  });

  it("splits a normal workday around the break", () => {
    const intervals = getWorkIntervals(
      at("10:00"),
      baseSettings,
      noHolidays,
      {},
    );
    expect(intervals).toEqual([
      { startMinutes: 630, endMinutes: 720 },
      { startMinutes: 810, endMinutes: 1140 },
    ]);
  });
});

describe("calculateWorkMetrics", () => {
  it("calculates hourly rate and current-day progress during work", () => {
    const metrics = calculateWorkMetrics(at("11:30"), baseSettings, noHolidays);
    expect(metrics.status).toBe("working");
    expect(metrics.plannedMinutesToday).toBe(420);
    expect(metrics.elapsedMinutesToday).toBe(60);
    expect(metrics.dayProgress).toBeCloseTo(1 / 7);
    expect(metrics.earningsPerSecond).toBeGreaterThan(0);
    expect(metrics.earnedToday).toBeCloseTo(metrics.hourlyRate);
  });

  it("does not accrue during lunch while counting down to work end", () => {
    const before = calculateWorkMetrics(at("11:59"), baseSettings, noHolidays);
    const during = calculateWorkMetrics(at("12:30"), baseSettings, noHolidays);
    expect(during.status).toBe("break");
    expect(during.elapsedMinutesToday - before.elapsedMinutesToday).toBeCloseTo(
      1,
    );
    expect(during.countdownSeconds).toBe(6.5 * 60 * 60);
    expect(during.earningsPerSecond).toBe(0);
  });

  it("shows rest day and zero daily accrual on weekends", () => {
    const metrics = calculateWorkMetrics(
      new Date("2025-11-08T12:00:00"),
      baseSettings,
      noHolidays,
    );
    expect(metrics.status).toBe("rest");
    expect(metrics.plannedMinutesToday).toBe(0);
    expect(metrics.earnedToday).toBe(0);
    expect(metrics.dayProgress).toBe(0);
    expect(metrics.earningsPerSecond).toBe(0);
  });

  it("allows a makeup workday to override the weekly rest rule", () => {
    const holiday: HolidayCalendar = {
      "2025-11-08": { kind: "work", name: "补班" },
    };
    const metrics = calculateWorkMetrics(
      new Date("2025-11-08T11:30:00"),
      baseSettings,
      holiday,
    );
    expect(metrics.status).toBe("working");
    expect(metrics.elapsedMinutesToday).toBe(60);
  });

  it("handles after-work status and month progress", () => {
    const metrics = calculateWorkMetrics(at("20:00"), baseSettings, noHolidays);
    expect(metrics.status).toBe("after");
    expect(metrics.countdownSeconds).toBe(0);
    expect(metrics.elapsedMinutesToday).toBe(420);
    expect(metrics.earnedMonth).toBeGreaterThanOrEqual(metrics.earnedToday);
    expect(metrics.earningsPerSecond).toBe(0);
  });

  it("counts down to work start and has zero current speed before work", () => {
    const metrics = calculateWorkMetrics(at("10:00"), baseSettings, noHolidays);
    expect(metrics.status).toBe("before");
    expect(metrics.countdownSeconds).toBe(30 * 60);
    expect(metrics.earnedToday).toBe(0);
    expect(metrics.earningsPerSecond).toBe(0);
  });

  it("recomputes after sleep from the current clock across lunch", () => {
    const beforeSleep = calculateWorkMetrics(
      at("11:30"),
      baseSettings,
      noHolidays,
    );
    const afterWake = calculateWorkMetrics(
      at("14:00"),
      baseSettings,
      noHolidays,
    );
    expect(
      afterWake.elapsedMinutesToday - beforeSleep.elapsedMinutesToday,
    ).toBe(60);
    expect(afterWake.earnedToday).toBeCloseTo(beforeSleep.earnedToday * 2);
    expect(calculateWorkMetrics(at("11:30"), baseSettings, noHolidays)).toEqual(
      beforeSleep,
    );
  });

  it("resets daily progress while retaining past days at midnight", () => {
    const previous = calculateWorkMetrics(
      new Date(2025, 10, 5, 23, 59, 59),
      baseSettings,
      noHolidays,
    );
    const next = calculateWorkMetrics(
      new Date(2025, 10, 6, 0, 0, 0),
      baseSettings,
      noHolidays,
    );
    expect(next.date).toBe("2025-11-06");
    expect(next.elapsedMinutesToday).toBe(0);
    expect(next.earnedToday).toBe(0);
    expect(next.earnedMonth).toBeCloseTo(previous.earnedMonth);
  });

  it("uses the new month denominator and resets the monthly total", () => {
    const previous = calculateWorkMetrics(
      new Date(2025, 9, 31, 23, 59, 59),
      baseSettings,
      noHolidays,
    );
    const next = calculateWorkMetrics(
      new Date(2025, 10, 1, 0, 0, 0),
      baseSettings,
      noHolidays,
    );
    expect(previous.earnedMonth).toBeCloseTo(baseSettings.monthlySalary);
    expect(next.earnedMonth).toBe(0);
    expect(next.earnedToday).toBe(0);
    expect(next.plannedMinutesMonth).not.toBe(previous.plannedMinutesMonth);
    expect((next.hourlyRate * next.plannedMinutesMonth) / 60).toBeCloseTo(
      baseSettings.monthlySalary,
    );
  });

  it("keeps every numeric metric finite for a month without work", () => {
    const settings = createDefaultSettings();
    settings.schedule.workDays = [];
    const metrics = calculateWorkMetrics(at("12:30"), settings, noHolidays);
    expect(metrics.status).toBe("rest");
    expect(metrics.plannedMinutesMonth).toBe(0);
    expect(metrics.hourlyRate).toBe(0);
    expect(metrics.earnedMonth).toBe(0);
    expect(
      Object.values(metrics)
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    ).toBe(true);
  });

  it("counts a complete continuous workday with lunch disabled", () => {
    const settings = createDefaultSettings();
    settings.schedule.breakStart = "00:00";
    settings.schedule.breakEnd = "00:00";
    const metrics = calculateWorkMetrics(at("12:30"), settings, noHolidays);
    expect(metrics.status).toBe("working");
    expect(metrics.elapsedMinutesToday).toBe(120);
    expect(metrics.plannedMinutesToday).toBe(510);
    expect(metrics.earningsPerSecond).toBeGreaterThan(0);
  });
});
