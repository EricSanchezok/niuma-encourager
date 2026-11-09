import { describe, expect, it } from "vitest";
import { MAINLAND_HOLIDAY_CALENDAR } from "./holidayData";

describe("official mainland holiday data", () => {
  it("has all 28 vacation dates and five makeup days from the 2025 notice", () => {
    const entries = Object.entries(MAINLAND_HOLIDAY_CALENDAR).filter(([date]) =>
      date.startsWith("2025"),
    );
    expect(
      entries.filter(([, holiday]) => holiday.kind === "rest"),
    ).toHaveLength(28);
    expect(
      entries
        .filter(([, holiday]) => holiday.kind === "work")
        .map(([date]) => date)
        .sort(),
    ).toEqual([
      "2025-01-26",
      "2025-02-08",
      "2025-04-27",
      "2025-09-28",
      "2025-10-11",
    ]);
  });

  it("has all 33 vacation dates and six makeup days from the 2026 notice", () => {
    const entries = Object.entries(MAINLAND_HOLIDAY_CALENDAR).filter(([date]) =>
      date.startsWith("2026"),
    );
    expect(
      entries.filter(([, holiday]) => holiday.kind === "rest"),
    ).toHaveLength(33);
    expect(
      entries
        .filter(([, holiday]) => holiday.kind === "work")
        .map(([date]) => date)
        .sort(),
    ).toEqual([
      "2026-01-04",
      "2026-02-14",
      "2026-02-28",
      "2026-05-09",
      "2026-09-20",
      "2026-10-10",
    ]);
  });

  it("keeps the Mid-Autumn Sunday separate from the National Day makeup Sunday", () => {
    expect(MAINLAND_HOLIDAY_CALENDAR["2026-09-20"]).toEqual({
      kind: "work",
      name: "国庆节补班",
    });
    expect(MAINLAND_HOLIDAY_CALENDAR["2026-09-27"]).toEqual({
      kind: "rest",
      name: "中秋节",
    });
  });
});
