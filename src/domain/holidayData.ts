import type { HolidayCalendar } from "./types";

function addRange(
  calendar: HolidayCalendar,
  start: string,
  end: string,
  name: string,
): void {
  const current = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (current <= last) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    calendar[key] = { kind: "rest", name };
    current.setDate(current.getDate() + 1);
  }
}

function addMakeup(
  calendar: HolidayCalendar,
  dates: string[],
  name: string,
): void {
  for (const date of dates) {
    calendar[date] = { kind: "work", name: `${name}补班` };
  }
}

const calendar: HolidayCalendar = {};

// 国办发明电〔2024〕12号
// https://www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm
addRange(calendar, "2025-01-01", "2025-01-01", "元旦");
addRange(calendar, "2025-01-28", "2025-02-04", "春节");
addMakeup(calendar, ["2025-01-26", "2025-02-08"], "春节");
addRange(calendar, "2025-04-04", "2025-04-06", "清明节");
addRange(calendar, "2025-05-01", "2025-05-05", "劳动节");
addMakeup(calendar, ["2025-04-27"], "劳动节");
addRange(calendar, "2025-05-31", "2025-06-02", "端午节");
addRange(calendar, "2025-10-01", "2025-10-08", "国庆节与中秋节");
addMakeup(calendar, ["2025-09-28", "2025-10-11"], "国庆节");

// 国办发明电〔2025〕7号
// https://www.gov.cn/zhengce/content/202511/content_7047090.htm
addRange(calendar, "2026-01-01", "2026-01-03", "元旦");
addMakeup(calendar, ["2026-01-04"], "元旦");
addRange(calendar, "2026-02-15", "2026-02-23", "春节");
addMakeup(calendar, ["2026-02-14", "2026-02-28"], "春节");
addRange(calendar, "2026-04-04", "2026-04-06", "清明节");
addRange(calendar, "2026-05-01", "2026-05-05", "劳动节");
addMakeup(calendar, ["2026-05-09"], "劳动节");
addRange(calendar, "2026-06-19", "2026-06-21", "端午节");
addRange(calendar, "2026-09-25", "2026-09-27", "中秋节");
addRange(calendar, "2026-10-01", "2026-10-07", "国庆节");
addMakeup(calendar, ["2026-09-20", "2026-10-10"], "国庆节");

export const MAINLAND_HOLIDAY_CALENDAR: HolidayCalendar = calendar;
