import { expect, test, type Page } from "@playwright/test";

const DETAIL_PATH = "/topics/LBS/BIS,WS_LBS_D_PUB,1.0/Q.S.C.A.TO1.A.5J.A.5A.A.5J.A";

async function gotoLbsDetail(page: Page): Promise<void> {
  await page.goto(DETAIL_PATH);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/All reporting countries/i);
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Time Series Detail Add time series", () => {
  test("adds and removes a comparison time series from the detail page", async ({ page }) => {
    await gotoLbsDetail(page);

    await main(page).getByRole("button", { name: "Add time series" }).click();

    const dialog = page.locator('[role="dialog"][data-state="open"]').filter({ hasText: "Add time series" });
    await expect(dialog).toBeAttached();
    await expect(dialog).toContainText("Add time series");
    await expect(dialog.getByRole("combobox", { name: "Search for time series" })).toBeAttached();
    await expect(dialog.getByRole("button", { name: "Filters" })).toBeAttached();
    await expect(dialog.getByText(/time series found/i)).toBeVisible();
    await expect(dialog.getByText("1 / 8 time series selected")).toBeVisible();

    await dialog.getByRole("button", { name: "Toggle timeseries" }).nth(1).click({ force: true });
    await expect(dialog.getByText("2 / 8 time series selected")).toBeVisible();

    await dialog.getByRole("button", { name: "Update selection" }).click({ force: true });
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/additional_ts=/);
    await expect(main(page).getByRole("region", { name: "Time series list" })).toBeVisible();

    await main(page).getByRole("button", { name: "Add time series" }).click();
    await expect(page.locator('[role="dialog"][data-state="open"]').getByText(/2 \/ 8 time series selected/)).toBeAttached();
  });
});
