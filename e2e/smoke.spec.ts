import { expect, test } from "@playwright/test";

test("saves settings and calendar overrides through the normal UI", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-11-03T13:44:36+08:00") });
  await page.goto("/");
  await expect(page.getByText("今日已赚", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "工作日历", exact: true }),
  ).toBeInViewport();

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("月薪", { exact: false }).fill("20000");
  await page.getByLabel("下班时间", { exact: true }).fill("09:00");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("下班时间");
  await page.getByLabel("下班时间", { exact: true }).fill("19:00");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await page.getByRole("button", { name: "工作日历", exact: true }).click();
  await page
    .getByRole("button", { name: "2026-11-03 上班", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "2026-11-03 休息（已调整）",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "回到今日", exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "回到今日", exact: true }).click();
  await expect(page.getByText("休息日", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("休息日", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("月薪", { exact: false })).toHaveValue("20000");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "切换迷你窗口", exact: true }).click();
  await page.setViewportSize({ width: 340, height: 220 });
  await expect(page.getByRole("progressbar")).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
