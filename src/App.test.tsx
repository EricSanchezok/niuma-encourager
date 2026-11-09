import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createDefaultSettings } from "./domain/defaults";
import type { AppSettings, CalendarOverrides } from "./domain/types";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  persist: vi.fn(),
  setPinned: vi.fn().mockResolvedValue(undefined),
  applyWindowMode: vi.fn().mockResolvedValue(undefined),
  readMode: vi.fn().mockResolvedValue(false),
}));

vi.mock("./persistence/store", () => ({
  readPersistedState: mocks.read,
  persistState: mocks.persist,
}));

vi.mock("./platform/window", () => ({
  setPinned: mocks.setPinned,
  getPinned: vi.fn().mockResolvedValue(false),
  readWindowMode: mocks.readMode,
  isTauri: () => false,
  hideWindow: vi.fn().mockResolvedValue(undefined),
  applyWindowMode: mocks.applyWindowMode,
}));

let persisted: {
  settings?: unknown;
  overrides?: CalendarOverrides;
  configured?: boolean;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 11, 30, 0));
  persisted = {};
  mocks.read.mockReset().mockImplementation(async () => persisted);
  mocks.persist
    .mockReset()
    .mockImplementation(async (settings, overrides, configured) => {
      persisted = { settings, overrides, configured };
    });
  mocks.setPinned.mockClear();
  mocks.applyWindowMode.mockClear();
  mocks.readMode.mockReset().mockResolvedValue(false);
});

async function openApp() {
  const result = render(<App />);
  await screen.findByText("今日已赚");
  return result;
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "设置" }));
  await screen.findByLabelText(/月薪/);
}

async function openCalendar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "工作日历" }));
  await screen.findByRole("heading", { name: "工作日历" });
}

async function returnToDashboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "回到今日" }));
  await screen.findByText("今日已赚");
}

function deferNextSave() {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  mocks.persist.mockImplementationOnce(
    async (settings, overrides, configured) => {
      await pending;
      persisted = { settings, overrides, configured };
    },
  );
  return release;
}

describe("desktop companion", () => {
  it("waits for native mode restoration before showing the dashboard", async () => {
    let finishModeRestore!: (mini: boolean) => void;
    mocks.readMode.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishModeRestore = resolve;
        }),
    );
    render(<App />);
    await waitFor(() => expect(mocks.readMode).toHaveBeenCalled());
    expect(screen.queryByText("今日已赚")).not.toBeInTheDocument();
    expect(screen.queryByText("本月累计")).not.toBeInTheDocument();
    await act(async () => finishModeRestore(true));
    expect(
      await screen.findByRole("button", { name: "展开窗口" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("牛马鼓励器")).not.toBeInTheDocument();
  });

  it("switches between the full dashboard and mini window", async () => {
    const user = userEvent.setup();
    await openApp();
    expect(screen.getByText("本月累计")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "切换迷你窗口" }));
    await waitFor(() =>
      expect(screen.queryByText("本月累计")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("牛马鼓励器")).not.toBeInTheDocument();
    expect(screen.getByText("今日已赚")).toBeInTheDocument();
    expect(mocks.applyWindowMode).toHaveBeenLastCalledWith(true);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "展开窗口" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "展开窗口" }));
    expect(await screen.findByText("本月累计")).toBeInTheDocument();
    expect(mocks.applyWindowMode).toHaveBeenLastCalledWith(false);
  });

  it("keeps the complete window usable when a native mode change fails", async () => {
    const user = userEvent.setup();
    await openApp();
    mocks.applyWindowMode.mockRejectedValueOnce(
      new Error("Native window unavailable"),
    );
    await user.click(screen.getByRole("button", { name: "切换迷你窗口" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/窗口/);
    expect(screen.getByText("本月累计")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换迷你窗口" })).toBeEnabled();
  });

  it("saves salary and goal changes and restores them after reopening", async () => {
    const user = userEvent.setup();
    const app = await openApp();
    await openSettings(user);
    fireEvent.change(screen.getByLabelText(/月薪/), {
      target: { value: "20000" },
    });
    fireEvent.change(screen.getByLabelText(/激励事项/), {
      target: { value: "一台相机" },
    });
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    await screen.findByText("一台相机");
    await waitFor(() =>
      expect((persisted.settings as AppSettings)?.monthlySalary).toBe(20000),
    );
    app.unmount();
    await openApp();
    expect(screen.getByText("一台相机")).toBeInTheDocument();
    await openSettings(user);
    expect(screen.getByLabelText(/月薪/)).toHaveValue(20000);
  });

  it("discards a draft when settings are cancelled", async () => {
    const user = userEvent.setup();
    await openApp();
    await openSettings(user);
    fireEvent.change(screen.getByLabelText(/激励事项/), {
      target: { value: "未保存目标" },
    });
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(
      await screen.findByText(createDefaultSettings().goal.name),
    ).toBeInTheDocument();
    expect(screen.queryByText("未保存目标")).not.toBeInTheDocument();
  });

  it("keeps invalid schedule edits in settings and explains the correction", async () => {
    const user = userEvent.setup();
    await openApp();
    await openSettings(user);
    fireEvent.change(screen.getByLabelText(/下班时间/), {
      target: { value: "09:00" },
    });
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /下班|工作|时间/,
    );
    expect(
      screen.getByRole("button", { name: "保存设置" }),
    ).toBeInTheDocument();
    expect(
      (persisted.settings as AppSettings | undefined)?.schedule.workEnd,
    ).not.toBe("09:00");
  });

  it("keeps the settings draft available when saving to disk fails", async () => {
    const user = userEvent.setup();
    await openApp();
    await openSettings(user);
    fireEvent.change(screen.getByLabelText(/激励事项/), {
      target: { value: "稍后保存的目标" },
    });
    mocks.persist.mockRejectedValueOnce(new Error("Disk full"));
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/保存失败/);
    expect(screen.getByLabelText(/激励事项/)).toHaveValue("稍后保存的目标");
    expect(screen.getByRole("button", { name: "保存设置" })).toBeEnabled();
  });

  it("recovers invalid restored settings before rendering income", async () => {
    persisted = {
      settings: {
        monthlySalary: -500,
        schedule: { workStart: "23:59", workEnd: "00:01", workDays: "broken" },
      },
      configured: true,
    };
    const user = userEvent.setup();
    await openApp();
    expect(screen.getByText("本月累计")).toBeInTheDocument();
    await openSettings(user);
    expect(screen.getByLabelText(/月薪/)).toHaveValue(
      createDefaultSettings().monthlySalary,
    );
    expect(screen.getByLabelText(/上班时间/)).toHaveValue("10:30");
    expect(screen.getByLabelText(/下班时间/)).toHaveValue("19:00");
  });

  it("persists a day override and removes it when the same day is restored", async () => {
    const user = userEvent.setup();
    const app = await openApp();
    await openCalendar(user);
    const day = screen.getByRole("button", { name: "2026-11-09 上班" });
    await user.click(day);
    await waitFor(() =>
      expect(persisted.overrides?.["2026-11-09"]).toBe("rest"),
    );
    expect(day).toHaveAccessibleName("2026-11-09 休息（已调整）");
    app.unmount();
    await openApp();
    expect(screen.getByText("休息日")).toBeInTheDocument();
    await openCalendar(user);
    await user.click(
      screen.getByRole("button", { name: "2026-11-09 休息（已调整）" }),
    );
    await waitFor(() =>
      expect(persisted.overrides?.["2026-11-09"]).toBeUndefined(),
    );
  });

  it("preserves a pending calendar edit when settings are saved from another page", async () => {
    const user = userEvent.setup();
    await openApp();
    const releaseCalendarSave = deferNextSave();
    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "2026-11-09 上班" }));
    await waitFor(() => expect(mocks.persist).toHaveBeenCalledTimes(1));

    await openSettings(user);
    fireEvent.change(screen.getByLabelText(/月薪/), {
      target: { value: "22000" },
    });
    fireEvent.change(screen.getByLabelText(/激励事项/), {
      target: { value: "排班保存后买相机" },
    });
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(screen.getByRole("button", { name: "保存设置" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存设置" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(mocks.persist).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseCalendarSave();
    });
    await screen.findByText("排班保存后买相机");
    expect(mocks.persist).toHaveBeenCalledTimes(2);
    expect((persisted.settings as AppSettings).monthlySalary).toBe(22000);
    expect(persisted.overrides).toEqual({ "2026-11-09": "rest" });
    expect(persisted.configured).toBe(true);
  });

  it("merges edits queued from two calendar visits while the first disk write is pending", async () => {
    const user = userEvent.setup();
    await openApp();
    const releaseFirstSave = deferNextSave();
    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "2026-11-09 上班" }));
    await waitFor(() => expect(mocks.persist).toHaveBeenCalledTimes(1));

    await returnToDashboard(user);
    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "2026-11-10 上班" }));
    expect(mocks.persist).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirstSave();
    });
    await waitFor(() =>
      expect(persisted.overrides).toEqual({
        "2026-11-09": "rest",
        "2026-11-10": "rest",
      }),
    );
    expect(mocks.persist).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "2026-11-09 休息（已调整）" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "2026-11-10 休息（已调整）" }),
    ).toBeEnabled();
  });

  it("shows an estimate prompt for zero salary without marking a positive goal achieved", async () => {
    persisted = {
      settings: { ...createDefaultSettings(), monthlySalary: 0 },
      configured: true,
    };
    await openApp();
    expect(screen.getByText("设置薪资和排班后估算")).toBeInTheDocument();
    expect(screen.queryByText("本月目标已达成")).not.toBeInTheDocument();
  });

  it("updates the pin control and sends the setting to the native window", async () => {
    const user = userEvent.setup();
    await openApp();
    await user.click(screen.getByRole("button", { name: "窗口置顶" }));
    expect(
      await screen.findByRole("button", { name: "取消置顶" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.setPinned).toHaveBeenCalledWith(true));
    await user.click(screen.getByRole("button", { name: "取消置顶" }));
    await waitFor(() =>
      expect(mocks.setPinned).toHaveBeenLastCalledWith(false),
    );
  });

  it("returns from settings with Escape and discards the unsaved draft", async () => {
    const user = userEvent.setup();
    await openApp();
    await openSettings(user);
    fireEvent.change(screen.getByLabelText(/激励事项/), {
      target: { value: "键盘取消的草稿" },
    });
    await user.keyboard("{Escape}");
    expect(await screen.findByText("今日已赚")).toBeInTheDocument();
    await openSettings(user);
    expect(screen.getByLabelText(/激励事项/)).toHaveValue(
      createDefaultSettings().goal.name,
    );
  });
});
