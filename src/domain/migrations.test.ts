import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, createDefaultSettings } from "./defaults";
import { migrateSettings } from "./migrations";
import { validateSettings } from "./validation";

describe("migrateSettings", () => {
  it("returns complete defaults for missing data", () => {
    expect(migrateSettings(null)).toEqual(createDefaultSettings());
  });

  it("fills missing nested values while preserving user settings", () => {
    const result = migrateSettings({
      schemaVersion: 0,
      monthlySalary: 20000,
      schedule: { workDays: [1, 2, 3, 4, 5], workStart: "09:00" },
    });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.monthlySalary).toBe(20000);
    expect(result.schedule.workStart).toBe("09:00");
    expect(result.schedule.workEnd).toBe("19:00");
    expect(result.goal.name).toBe("一件冲锋衣");
  });

  it.each([null, undefined, [], true, 12, "settings"])(
    "recovers malformed persisted roots %j",
    (input) => {
      expect(migrateSettings(input)).toEqual(createDefaultSettings());
    },
  );

  it("rejects malformed persisted values without losing valid sibling fields", () => {
    const result = migrateSettings({
      schemaVersion: -10,
      currency: "USD",
      monthlySalary: -100,
      schedule: { workDays: [1, 8], workStart: "25:00" },
      goal: { name: "旅行", amount: Infinity },
      unknown: "ignored",
    });
    expect(result).toEqual({
      ...createDefaultSettings(),
      goal: { name: "旅行", amount: 2500 },
    });
    expect(validateSettings(result).valid).toBe(true);
    expect("unknown" in result).toBe(false);
  });

  it("recovers an inconsistent schedule while preserving valid weekdays", () => {
    const result = migrateSettings({
      monthlySalary: 0,
      schedule: { workDays: [], workStart: "20:00", workEnd: "09:00" },
    });
    expect(result.schedule).toEqual({
      ...createDefaultSettings().schedule,
      workDays: [],
    });
    expect(result.monthlySalary).toBe(0);
  });

  it("preserves a valid no-lunch schedule and returns independent nested values", () => {
    const input = {
      schedule: { workDays: [1], breakStart: "00:00", breakEnd: "00:00" },
      goal: { name: "  旅行  ", amount: 5000 },
    };
    const result = migrateSettings(input);
    input.schedule.workDays.push(2);
    expect(result.schedule.workDays).toEqual([1]);
    expect(result.schedule.breakStart).toBe("00:00");
    expect(result.goal.name).toBe("旅行");
    expect(validateSettings(result).valid).toBe(true);
  });
});
