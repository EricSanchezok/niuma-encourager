import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Target,
  Check,
  Clock3,
  LoaderCircle,
  X,
} from "lucide-react";
import { calculateWorkMetrics } from "./domain/calculator";
import { dateKey, isWorkingDay } from "./domain/calendar";
import { createDefaultSettings } from "./domain/defaults";
import { migrateSettings } from "./domain/migrations";
import { validateSettings } from "./domain/validation";
import {
  applyWindowMode,
  getPinned,
  hideWindow,
  readWindowMode,
  setPinned as setWindowPinned,
} from "./platform/window";
import { messages as t } from "./i18n";
import { MAINLAND_HOLIDAY_CALENDAR } from "./domain/holidayData";
import type { AppSettings, CalendarOverrides, Weekday } from "./domain/types";
import { readPersistedState, persistState } from "./persistence/store";
import { AnimatedNumber, MoneyDisplay } from "./components/AnimatedNumber";
import "./App.css";

type View = "dashboard" | "settings" | "calendar";

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 0, label: "日" },
];

const STATUS_LABELS = t.status;
const COUNTDOWN_LABELS = {
  before: t.toWork,
  working: t.toHome,
  break: t.toHome,
  rest: t.restDay,
  after: t.dayDone,
};

function formatMoney(value: number, digits = 2): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.max(0, value));
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatDate(date: Date): string {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}  周${weekdays[date.getDay()]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", { hour12: false });
}

function formatDuration(minutes: number): string {
  const rounded = Math.ceil(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${hours}小时${String(rest).padStart(2, "0")}分`;
}

function IconButton({
  label,
  onClick,
  children,
  active,
  disabled = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="button-glyph">{children}</span>
    </button>
  );
}

function Header({
  view,
  mini,
  pinned,
  busy,
  demo,
  onViewChange,
  onMiniChange,
  onPinChange,
}: {
  view: View;
  mini: boolean;
  pinned: boolean;
  busy: boolean;
  demo: boolean;
  onViewChange: (view: View) => void;
  onMiniChange: (mini: boolean) => void;
  onPinChange: (pinned: boolean) => void;
}) {
  return (
    <header
      className={`app-header ${mini ? "mini-toolbar" : ""}`}
      data-tauri-drag-region={!mini || undefined}
    >
      {!mini && (
        <div className="brand" data-tauri-drag-region>
          <img
            className="brand-logo"
            src="/favicon.svg"
            alt=""
            draggable="false"
            data-tauri-drag-region
          />
          <strong data-tauri-drag-region>{t.appName}</strong>
          {demo && (
            <button
              type="button"
              className="demo-indicator"
              title="设置我的薪资"
              aria-label="设置我的薪资"
              onClick={() => onViewChange("settings")}
            >
              示例
            </button>
          )}
        </div>
      )}
      <div className="header-actions" role="group" aria-label="窗口操作">
        {view === "dashboard" && (
          <IconButton
            label={mini ? t.expand : t.mini}
            disabled={busy}
            onClick={() => onMiniChange(!mini)}
          >
            {mini ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </IconButton>
        )}
        <IconButton
          label={pinned ? t.unpin : t.pin}
          className="pin-control"
          active={pinned}
          onClick={() => onPinChange(!pinned)}
        >
          {pinned ? <Pin size={16} /> : <PinOff size={16} />}
        </IconButton>
        <IconButton
          label={t.calendar}
          disabled={busy}
          active={view === "calendar"}
          onClick={() =>
            onViewChange(view === "calendar" ? "dashboard" : "calendar")
          }
        >
          <CalendarDays size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton
          label={t.settings}
          disabled={busy}
          active={view === "settings"}
          onClick={() =>
            onViewChange(view === "settings" ? "dashboard" : "settings")
          }
        >
          <SettingsIcon size={16} />
        </IconButton>
        <IconButton label={t.hide} onClick={() => void hideWindow()}>
          <X size={17} />
        </IconButton>
      </div>
    </header>
  );
}

function StatusPill({ status }: { status: keyof typeof STATUS_LABELS }) {
  return (
    <span className={`status-pill status-${status}`}>
      <span className="status-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function Dashboard({
  settings,
  metrics,
  now,
  mini,
}: {
  settings: AppSettings;
  metrics: ReturnType<typeof calculateWorkMetrics>;
  now: Date;
  mini: boolean;
}) {
  const hoursToday = metrics.elapsedMinutesToday / 60;
  const plannedHours = metrics.plannedMinutesToday / 60;
  const progress = Math.round(metrics.dayProgress * 1000) / 10;

  const goalComplete = metrics.earnedMonth >= settings.goal.amount;

  if (mini) {
    return (
      <main className="mini-dashboard" data-tauri-drag-region>
        <div className="mini-topline" data-tauri-drag-region>
          <span>{t.earnedToday}</span>
          <span className="mini-status">
            <StatusPill status={metrics.status} />
          </span>
        </div>
        <div className="mini-amount" data-tauri-drag-region>
          <MoneyDisplay value={metrics.earnedToday} />
        </div>
        <div className="mini-row" data-tauri-drag-region>
          <span>{COUNTDOWN_LABELS[metrics.status]}</span>
          <AnimatedNumber
            value={formatClock(metrics.countdownSeconds)}
            variant="clock"
            direction="down"
          />
          <span className="mini-percentage">
            {progress.toFixed(1)}
            <small>%</small>
          </span>
        </div>
        <div
          className="progress-track progress-track-compact"
          role="progressbar"
          aria-label="工时进度"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ transform: `scaleX(${metrics.dayProgress})` }} />
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-content">
      <div className="today-intro">
        <p>{formatDate(now)}</p>
        <time dateTime={now.toISOString()}>{formatTime(now)}</time>
      </div>
      <section className="earnings-card" aria-label="今日收入">
        <div className="earnings-card-topline">
          <span>{t.earnedToday}</span>
          <StatusPill status={metrics.status} />
        </div>
        <MoneyDisplay className="earnings-number" value={metrics.earnedToday} />
        <div className="earnings-meta">
          <span>{t.currentRate}</span>
          <span className="earnings-rate">
            {formatMoney(metrics.earningsPerSecond, 4)}
            <span> / 秒</span>
          </span>
        </div>
        <div className="work-progress">
          <span>
            {hoursToday.toFixed(2)}
            <span> / {plannedHours.toFixed(2)} 小时</span>
          </span>
          <span>
            {progress.toFixed(1)}
            <small>%</small>
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="工时进度"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ transform: `scaleX(${metrics.dayProgress})` }} />
        </div>
      </section>
      <section className="countdown-row">
        <div>
          <span className="section-kicker">
            {COUNTDOWN_LABELS[metrics.status]}
          </span>
          <AnimatedNumber
            className="countdown-value"
            value={formatClock(metrics.countdownSeconds)}
            variant="clock"
            direction="down"
          />
        </div>
        <div className="schedule-chip">
          <Clock3 size={14} strokeWidth={1.5} />
          <span>
            {settings.schedule.workStart} — {settings.schedule.workEnd}
          </span>
        </div>
      </section>
      <section className={`goal-row ${goalComplete ? "is-complete" : ""}`}>
        <div className="goal-icon">
          {goalComplete ? (
            <Check size={17} />
          ) : (
            <Target size={18} strokeWidth={1.5} />
          )}
        </div>
        <div className="goal-copy">
          <strong title={settings.goal.name}>
            {settings.goal.name || "本月目标"}
          </strong>
          <span>
            {goalComplete
              ? "本月目标已达成"
              : metrics.hourlyRate > 0
                ? `还需工作 ${formatDuration(metrics.goalRemainingHours * 60)}`
                : "设置薪资和排班后估算"}
          </span>
        </div>
        <span className="goal-amount">{formatMoney(settings.goal.amount)}</span>
      </section>
      <section className="monthly-card">
        <div className="monthly-heading">
          <span className="section-kicker">{t.earnedMonth}</span>
          <MoneyDisplay
            value={metrics.earnedMonth}
            precision={2}
            className="monthly-total"
          />
        </div>
        <div className="monthly-details">
          <span>
            {t.hourlyRate}
            <strong>{formatMoney(metrics.hourlyRate)}</strong>
          </span>
          <span>
            今日满勤
            <strong>{formatMoney(metrics.hourlyRate * plannedHours)}</strong>
          </span>
        </div>
      </section>
    </main>
  );
}

function SettingsPanel({
  settings,
  onSave,
  onCancel,
}: {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = async () => {
    const validation = validateSettings(draft);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setError(Object.values(validation.errors)[0]);
      window.requestAnimationFrame?.(() =>
        document
          .querySelector<HTMLInputElement>('input[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setFieldErrors({});
    setError("");
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      setError("保存失败，请检查本机存储空间后重试。");
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (
    key: keyof AppSettings["schedule"],
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      schedule: { ...current.schedule, [key]: value },
    }));
  };

  const toggleWeekday = (day: Weekday) => {
    setDraft((current) => {
      const workDays = current.schedule.workDays.includes(day)
        ? current.schedule.workDays.filter((item) => item !== day)
        : [...current.schedule.workDays, day];
      return {
        ...current,
        schedule: {
          ...current.schedule,
          workDays: workDays.sort((a, b) => a - b),
        },
      };
    });
  };

  return (
    <main className="settings-content">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="page-heading">
          <div>
            <h1>{t.settings}</h1>
          </div>
        </div>

        <div className="settings-grid">
          <label className="field field-wide">
            <span>{t.salary}</span>
            <div className="input-with-prefix">
              <span>¥</span>
              <input
                type="number"
                min="0"
                step="100"
                value={draft.monthlySalary}
                name="monthlySalary"
                aria-invalid={Boolean(fieldErrors["monthlySalary"])}
                aria-describedby={
                  fieldErrors["monthlySalary"] ? "settings-error" : undefined
                }
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    monthlySalary: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
          </label>
          <div className="field field-wide">
            <span>{t.workDays}</span>
            <div className="weekday-picker">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={
                    draft.schedule.workDays.includes(day.value)
                      ? "weekday is-selected"
                      : "weekday"
                  }
                  onClick={() => toggleWeekday(day.value)}
                  aria-pressed={draft.schedule.workDays.includes(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>{t.workStart}</span>
            <input
              type="time"
              value={draft.schedule.workStart}
              name="schedule.workStart"
              aria-invalid={Boolean(fieldErrors["schedule.workStart"])}
              aria-describedby={
                fieldErrors["schedule.workStart"] ? "settings-error" : undefined
              }
              onChange={(event) =>
                updateSchedule("workStart", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span>{t.workEnd}</span>
            <input
              type="time"
              value={draft.schedule.workEnd}
              name="schedule.workEnd"
              aria-invalid={Boolean(fieldErrors["schedule.workEnd"])}
              aria-describedby={
                fieldErrors["schedule.workEnd"] ? "settings-error" : undefined
              }
              onChange={(event) =>
                updateSchedule("workEnd", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span>{t.breakStart}</span>
            <input
              type="time"
              value={draft.schedule.breakStart}
              name="schedule.breakStart"
              aria-invalid={Boolean(fieldErrors["schedule.breakStart"])}
              aria-describedby={
                fieldErrors["schedule.breakStart"]
                  ? "settings-error"
                  : undefined
              }
              onChange={(event) =>
                updateSchedule("breakStart", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span>{t.breakEnd}</span>
            <input
              type="time"
              value={draft.schedule.breakEnd}
              name="schedule.breakEnd"
              aria-invalid={Boolean(fieldErrors["schedule.breakEnd"])}
              aria-describedby={
                fieldErrors["schedule.breakEnd"] ? "settings-error" : undefined
              }
              onChange={(event) =>
                updateSchedule("breakEnd", event.target.value)
              }
            />
          </label>
          <label className="field field-wide">
            <span>{t.goalName}</span>
            <input
              type="text"
              value={draft.goal.name}
              name="goal.name"
              aria-invalid={Boolean(fieldErrors["goal.name"])}
              aria-describedby={
                fieldErrors["goal.name"] ? "settings-error" : undefined
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  goal: { ...draft.goal, name: event.target.value },
                })
              }
              placeholder="例如 一件冲锋衣"
            />
          </label>
          <label className="field field-wide">
            <span>{t.goalAmount}</span>
            <div className="input-with-prefix">
              <span>¥</span>
              <input
                type="number"
                min="0"
                step="100"
                value={draft.goal.amount}
                name="goal.amount"
                aria-invalid={Boolean(fieldErrors["goal.amount"])}
                aria-describedby={
                  fieldErrors["goal.amount"] ? "settings-error" : undefined
                }
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    goal: {
                      ...draft.goal,
                      amount: Number(event.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </label>
        </div>

        {error && (
          <p className="error-message" id="settings-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            <RotateCcw size={16} />
            {t.cancel}
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            {t.save}
          </button>
        </div>
      </form>
    </main>
  );
}

function CalendarPanel({
  settings,
  overrides,
  onToggleDay,
  onBack,
}: {
  settings: AppSettings;
  overrides: CalendarOverrides;
  onToggleDay: (date: Date) => Promise<void>;
  onBack: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const monthLabel = month.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  });
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const cells = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1),
  );

  const toggleDay = async (date: Date) => {
    setSaving(true);
    try {
      await onToggleDay(date);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="calendar-content">
      <div className="page-heading calendar-heading">
        <div>
          <h1>{t.calendar}</h1>
          <p>点击切换排班，再次点击恢复默认</p>
        </div>
        <button
          type="button"
          className="back-link"
          onClick={onBack}
          aria-label={t.back}
        >
          <ChevronLeft size={16} />
          今日
        </button>
      </div>
      <section className="calendar-card">
        <div className="calendar-toolbar">
          <button
            type="button"
            className="month-nav"
            aria-label="上个月"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <strong>{monthLabel}</strong>
          <button
            type="button"
            className="month-nav"
            aria-label="下个月"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-weekdays">
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((date) => {
            const inMonth = date.getMonth() === month.getMonth();
            const key = dateKey(date);
            const holiday = MAINLAND_HOLIDAY_CALENDAR[key];
            const override = overrides[key];
            const working = override
              ? override === "work"
              : isWorkingDay(date, settings, MAINLAND_HOLIDAY_CALENDAR, {});
            return (
              <button
                key={key}
                type="button"
                className={`calendar-day ${inMonth ? "" : "is-outside"} ${working ? "is-work" : "is-rest"} ${override ? "has-override" : ""}`}
                aria-label={`${key} ${working ? "上班" : "休息"}${override ? "（已调整）" : ""}`}
                disabled={saving}
                onClick={() => void toggleDay(date)}
                title={
                  holiday?.name ?? (override ? "已手动调整" : "按默认排班")
                }
              >
                <span>{date.getDate()}</span>
                {holiday && <small>{holiday.name.replace("节", "")}</small>}
                {override && <i />}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="legend-dot legend-work" />
            上班
          </span>
          <span>
            <i className="legend-dot legend-rest" />
            休息
          </span>
          <span>
            <i className="legend-dot legend-override" />
            手动调整
          </span>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    createDefaultSettings(),
  );
  const [overrides, setOverrides] = useState<CalendarOverrides>({});
  const [view, setView] = useState<View>("dashboard");
  const [mini, setMini] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modePhase, setModePhase] = useState("idle");
  const [usingKeyboard, setUsingKeyboard] = useState(false);
  const changingMode = useRef(false);
  const latestState = useRef({ settings, overrides, configured });
  const pendingSave = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      readPersistedState(),
      getPinned(),
      readWindowMode(),
    ]).then(([storage, pin, mode]) => {
      if (!active) return;
      if (storage.status === "fulfilled") {
        const restored = {
          settings: migrateSettings(storage.value.settings),
          overrides: storage.value.overrides ?? {},
          configured: storage.value.configured ?? false,
        };
        latestState.current = restored;
        setSettings(restored.settings);
        setOverrides(restored.overrides);
        setConfigured(restored.configured);
      } else {
        setError("本机数据读取失败，正在使用示例设置。");
      }
      if (pin.status === "fulfilled") setPinned(pin.value);
      if (mode.status === "fulfilled") setMini(mode.value);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          event.key,
        )
      )
        setUsingKeyboard(true);
      if (
        event.key === "Escape" &&
        view !== "dashboard" &&
        !changingMode.current
      ) {
        event.preventDefault();
        setView("dashboard");
        window.requestAnimationFrame(() =>
          document
            .querySelector<HTMLButtonElement>(
              `.header-actions button[aria-label="${view === "calendar" ? t.calendar : t.settings}"]`,
            )
            ?.focus(),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const metrics = useMemo(
    () =>
      calculateWorkMetrics(now, settings, MAINLAND_HOLIDAY_CALENDAR, overrides),
    [now, settings, overrides],
  );

  if (!hydrated) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-mark">
          <span />
          <span />
          <span />
        </div>
        <p>正在准备今天的节奏</p>
      </div>
    );
  }

  const handlePinChange = async (value: boolean) => {
    try {
      await setWindowPinned(value);
      setPinned(value);
      setError("");
    } catch {
      setError("此桌面环境暂时无法切换置顶。");
    }
  };

  const handleMiniChange = async (
    value: boolean,
    nextView?: View,
  ): Promise<boolean> => {
    if (changingMode.current) return false;
    changingMode.current = true;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pause = (milliseconds: number) =>
      reduced
        ? Promise.resolve()
        : new Promise<void>((resolve) =>
            window.setTimeout(resolve, milliseconds),
          );
    setModePhase("leaving");
    try {
      await pause(110);
      await applyWindowMode(value);
      setMini(value);
      setError("");
      if (nextView) setView(nextView);
      setModePhase("arriving");
      await pause(190);
      setModePhase("idle");
      if (usingKeyboard) {
        window.requestAnimationFrame(() => {
          const selector =
            nextView === "settings"
              ? 'input[name="monthlySalary"]'
              : `.header-actions button[aria-label="${value ? t.expand : t.mini}"]`;
          document.querySelector<HTMLElement>(selector)?.focus();
        });
      }
      return true;
    } catch {
      setModePhase("idle");
      setError("窗口尺寸切换失败，请重试。");
      return false;
    } finally {
      changingMode.current = false;
    }
  };

  const handleViewChange = async (nextView: View) => {
    if (changingMode.current) return;
    if (mini) {
      await handleMiniChange(false, nextView);
      return;
    }
    setView(nextView);
  };

  const commitState = (
    update: (state: typeof latestState.current) => typeof latestState.current,
  ) => {
    const save = async () => {
      const next = update(latestState.current);
      await persistState(next.settings, next.overrides, next.configured);
      latestState.current = next;
      setSettings(next.settings);
      setOverrides(next.overrides);
      setConfigured(next.configured);
      setError("");
    };
    const operation = pendingSave.current.catch(() => undefined).then(save);
    pendingSave.current = operation;
    return operation;
  };

  const saveSettings = async (next: AppSettings) => {
    await commitState((state) => ({
      ...state,
      settings: next,
      configured: true,
    }));
    setView("dashboard");
    setNotice("设置已保存");
  };

  const saveOverrides = async (date: Date) => {
    try {
      await commitState((state) => {
        const next = { ...state.overrides };
        const key = dateKey(date);
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = isWorkingDay(
            date,
            state.settings,
            MAINLAND_HOLIDAY_CALENDAR,
            {},
          )
            ? "rest"
            : "work";
        }
        return { ...state, overrides: next };
      });
    } catch {
      setError("排班保存失败，请检查本机存储空间后重试。");
    }
  };

  return (
    <div
      className={`app-shell ${mini && view === "dashboard" ? "is-mini" : ""}`}
      data-mode-phase={modePhase}
      data-keyboard={usingKeyboard}
      onPointerDownCapture={() => setUsingKeyboard(false)}
    >
      <Header
        view={view}
        mini={mini}
        pinned={pinned}
        busy={modePhase !== "idle"}
        demo={!configured && view === "dashboard"}
        onViewChange={handleViewChange}
        onMiniChange={(next) => void handleMiniChange(next)}
        onPinChange={handlePinChange}
      />
      {error && (
        <p className="error-message app-error" role="alert">
          {error}
        </p>
      )}
      <div className="view-stage" key={`${view}:${mini}`}>
        {view === "dashboard" && (
          <Dashboard
            settings={settings}
            metrics={metrics}
            now={now}
            mini={mini}
          />
        )}
        {view === "settings" && (
          <SettingsPanel
            settings={settings}
            onSave={saveSettings}
            onCancel={() => setView("dashboard")}
          />
        )}
        {view === "calendar" && (
          <CalendarPanel
            settings={settings}
            overrides={overrides}
            onToggleDay={saveOverrides}
            onBack={() => setView("dashboard")}
          />
        )}
      </div>
      <div
        className={`feedback-toast ${notice ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={15} aria-hidden="true" />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
