import { expect, test, type Page } from "@playwright/test";

const workingTime = new Date("2026-11-03T13:44:36+08:00");

async function settleView(page: Page) {
  await expect
    .poll(() =>
      page
        .locator(".view-stage")
        .evaluate((element) =>
          element
            .getAnimations()
            .some((animation) => animation.playState === "running"),
        ),
    )
    .toBe(false);
}

test("fits the default full window closely around its content", async ({
  page,
}) => {
  await page.clock.install({ time: workingTime });
  await page.goto("/");
  const calendarLink = page.getByRole("button", {
    name: "工作日历",
    exact: true,
  });
  await expect(calendarLink).toBeInViewport();
  await settleView(page);
  const layout = await page.locator(".dashboard-content").evaluate((main) => {
    const link = main.querySelector(".calendar-link")!.getBoundingClientRect();
    return {
      bottomGap: innerHeight - link.bottom,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
    };
  });
  expect(layout.bottomGap).toBeGreaterThanOrEqual(8);
  expect(layout.bottomGap).toBeLessThanOrEqual(24);
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight);
});

test("updates only to real income and time values without shifting the numeric layout", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(workingTime.getTime() - 1_000) });
  await page.clock.pauseAt(workingTime);
  await page.goto("/");
  const money = page.getByRole("img", { name: "¥207.5397", exact: true });
  await expect(money).toBeVisible();
  await expect(
    page.getByRole("img", { name: "05:15:24", exact: true }),
  ).toBeVisible();
  await settleView(page);
  const initialMoneyBounds = await money.boundingBox();

  await page.clock.runFor(3_000);
  const updatedMoney = page.getByRole("img", {
    name: "¥207.6389",
    exact: true,
  });
  await expect(updatedMoney).toBeVisible();
  await expect(
    page.getByRole("img", { name: "05:15:21", exact: true }),
  ).toBeVisible();
  const updatedMoneyBounds = await updatedMoney.boundingBox();
  expect(updatedMoneyBounds?.x).toBe(initialMoneyBounds?.x);
  expect(updatedMoneyBounds?.width).toBe(initialMoneyBounds?.width);
  expect(
    await updatedMoney.evaluate((element) =>
      element.closest('[aria-live="polite"], [aria-live="assertive"]'),
    ),
  ).toBeNull();
});

test("keeps income readable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(workingTime.getTime() - 1_000) });
  await page.clock.pauseAt(workingTime);
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "¥207.5397", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(2_000);
  await expect(
    page.getByRole("img", { name: "¥207.6058", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return (
            target instanceof Element &&
            target.closest(".an-number") &&
            animation.playState === "running"
          );
        }).length,
    ),
  ).toBe(0);
});

test("keeps a large valid salary inside the earnings surface", async ({
  page,
}) => {
  await page.clock.install({ time: workingTime });
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("月薪", { exact: false }).fill("123456789");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByText("今日已赚", { exact: true })).toBeVisible();
  const money = page.locator(".earnings-card .an-number .an-visual");
  await expect(money).toBeVisible();
  await settleView(page);
  const fits = await money.evaluate((element) => {
    const card = element.closest(".earnings-card")!.getBoundingClientRect();
    const number = element.getBoundingClientRect();
    return number.left >= card.left && number.right <= card.right;
  });
  expect(fits).toBe(true);
  await page.getByRole("button", { name: "切换迷你窗口", exact: true }).click();
  await expect(page.locator(".app-shell.is-mini")).toBeVisible();
  await page.setViewportSize({ width: 340, height: 168 });
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-mode-phase",
    "idle",
  );
  const miniMoney = page.locator(".mini-amount .an-visual");
  await expect(miniMoney).toBeVisible();
  expect(
    await miniMoney.evaluate((element) => {
      const number = element.getBoundingClientRect();
      return number.left >= 0 && number.right <= innerWidth;
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("reveals mini controls on hover and keyboard focus without a permanent title", async ({
  page,
}) => {
  await page.clock.install({ time: workingTime });
  await page.goto("/");
  await page.getByRole("button", { name: "切换迷你窗口", exact: true }).click();
  await expect(page.locator(".app-shell.is-mini")).toBeVisible();
  await page.setViewportSize({ width: 340, height: 168 });
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-mode-phase",
    "idle",
  );
  const toolbar = page.locator(".mini-toolbar");
  const expand = page.getByRole("button", { name: "展开窗口", exact: true });
  // WebKit can retain button focus after a pointer click. Keep that focus
  // explicitly so pointer-leave cannot pass by dropping focus accidentally.
  await expand.focus();
  await expect(expand).toBeFocused();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-keyboard",
    "false",
  );
  await page.mouse.move(600, 400);
  await expect(page.getByText("牛马鼓励器", { exact: true })).toHaveCount(0);
  await expect(toolbar).toHaveCSS("opacity", "0");

  await page.locator(".mini-dashboard").hover();
  await expect(toolbar).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("button", { name: "展开窗口", exact: true }),
  ).toBeInViewport();
  await page.mouse.move(600, 400);
  await expect(expand).toBeFocused();
  await expect(toolbar).toHaveCSS("opacity", "0");
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  await page.keyboard.press("Tab");
  await expect(toolbar).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("button", { name: "展开窗口", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("本月累计", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "切换迷你窗口", exact: true }),
  ).toBeFocused();
});

test.describe("touch input", () => {
  test.use({ hasTouch: true });

  test("keeps mini controls available when hover is unavailable", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "切换迷你窗口", exact: true })
      .click();
    await expect(page.locator(".app-shell.is-mini")).toBeVisible();
    await page.setViewportSize({ width: 340, height: 168 });
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-mode-phase",
      "idle",
    );
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(
      true,
    );
    await expect(page.locator(".mini-toolbar")).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "展开窗口", exact: true }).tap();
    await expect(page.getByText("本月累计", { exact: true })).toBeVisible();
  });
});
