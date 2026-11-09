import { describe, expect, it } from "vitest";
import { parseTime, getWorkIntervals } from "./calendar";
import { createDefaultSettings } from "./defaults";
import { validateSettings } from "./validation";

describe("validateSettings", () => {
  it("accepts defaults, zero salary and an empty weekly schedule", () => {
    const settings = createDefaultSettings();
    expect(validateSettings(settings).valid).toBe(true);
    settings.monthlySalary = 0;
    settings.schedule.workDays = [];
    expect(validateSettings(settings).valid).toBe(true);
  });

  it.each([null, undefined, [], true, 12, "settings"])(
    "rejects invalid root values %j",
    (input) => {
      expect(validateSettings(input).valid).toBe(false);
    },
  );

  it.each([-1, NaN, Infinity, "1000", Number.MAX_VALUE])(
    "rejects invalid salary %j",
    (monthlySalary) => {
      const settings = { ...createDefaultSettings(), monthlySalary };
      expect(validateSettings(settings).errors.monthlySalary).toBeDefined();
    },
  );

  it.each([[0, 1, 7], [1, 1], [-1], ["1"], "12345"])(
    "rejects invalid weekday values %j",
    (workDays) => {
      const settings = createDefaultSettings();
      const result = validateSettings({
        ...settings,
        schedule: { ...settings.schedule, workDays },
      });
      expect(result.errors["schedule.workDays"]).toBeDefined();
    },
  );

  it.each(["1:00", "24:00", "12:60", "10:30:00", "", " 10:30", "10:30junk"])(
    "rejects malformed time %j",
    (workStart) => {
      const settings = createDefaultSettings();
      const result = validateSettings({
        ...settings,
        schedule: { ...settings.schedule, workStart },
      });
      expect(result.errors["schedule.workStart"]).toBeDefined();
      expect(() => parseTime(workStart)).toThrow();
    },
  );

  it("rejects inverted work hours and an invalid lunch break", () => {
    const settings = createDefaultSettings();
    settings.schedule.workEnd = "10:00";
    expect(validateSettings(settings).errors["schedule.workEnd"]).toBeDefined();
    settings.schedule.workEnd = "19:00";
    settings.schedule.breakEnd = "11:00";
    expect(
      validateSettings(settings).errors["schedule.breakEnd"],
    ).toBeDefined();
    settings.schedule.breakEnd = "20:00";
    expect(
      validateSettings(settings).errors["schedule.breakEnd"],
    ).toBeDefined();
    settings.schedule.breakStart = "10:30";
    settings.schedule.breakEnd = "19:00";
    expect(
      validateSettings(settings).errors["schedule.breakEnd"],
    ).toBeDefined();
  });

  it("accepts a disabled lunch break as equal times", () => {
    const settings = createDefaultSettings();
    settings.schedule.breakStart = "00:00";
    settings.schedule.breakEnd = "00:00";
    expect(validateSettings(settings).valid).toBe(true);
    expect(getWorkIntervals(new Date(2025, 10, 5), settings, {}, {})).toEqual([
      { startMinutes: 630, endMinutes: 1140 },
    ]);
  });

  it("validates nested goal, currency and schema values", () => {
    const settings = createDefaultSettings();
    expect(
      validateSettings({ ...settings, goal: null }).errors.goal,
    ).toBeDefined();
    expect(
      validateSettings({ ...settings, goal: { name: " ", amount: -5 } }).errors,
    ).toEqual({
      "goal.name": expect.any(String),
      "goal.amount": expect.any(String),
    });
    expect(
      validateSettings({ ...settings, currency: "USD", schemaVersion: 0 })
        .valid,
    ).toBe(false);
  });
});
