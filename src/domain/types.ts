export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CalendarDayKind = "work" | "rest";

export type DayOverrideKind = CalendarDayKind;

export type HolidayEntry = {
  kind: CalendarDayKind;
  name: string;
};

export type CalendarOverrides = Record<string, DayOverrideKind>;

export type HolidayCalendar = Record<string, HolidayEntry>;

export type WorkInterval = {
  startMinutes: number;
  endMinutes: number;
};

export type ScheduleSettings = {
  workDays: Weekday[];
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
};

export type GoalSettings = {
  name: string;
  amount: number;
};

export type AppSettings = {
  schemaVersion: number;
  monthlySalary: number;
  currency: "CNY";
  schedule: ScheduleSettings;
  goal: GoalSettings;
};

export type WorkStatus = "rest" | "before" | "working" | "break" | "after";

export type WorkMetrics = {
  date: string;
  status: WorkStatus;
  plannedMinutesToday: number;
  elapsedMinutesToday: number;
  plannedMinutesMonth: number;
  elapsedMinutesMonth: number;
  hourlyRate: number;
  earnedToday: number;
  earnedMonth: number;
  earningsPerSecond: number;
  dayProgress: number;
  countdownSeconds: number;
  goalRemainingHours: number;
};
