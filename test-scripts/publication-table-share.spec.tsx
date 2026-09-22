import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Publication Table Share`, () => {
  test(`Publication Table Share`, async ({ page }) => {
    await it.step(`1. Navigate to the LBS A1 publication table`, async () => {
      await gotoPath(page, "/topics/LBS/tables-and-dashboards/BIS,LBS_A1,1.0");
      await expect(page.getByRole("grid")).toBeVisible();
    });

    await it.step(`2. Table filters are represented in the URL and controls`, async () => {
      const date = page.getByRole("combobox", { name: "publication table date" });
      await expect(date).toBeVisible();
      await date.click();
      await date.fill("2020-Q1");
      await page.keyboard.press("Enter");

      await page.getByRole("combobox", { name: "Measure" }).click();
      await page.getByRole("option", { name: "FX and break adjusted change (BIS calculated)" }).click();

      await page.getByRole("combobox", { name: "View" }).click();
      await page.getByRole("option", { name: "Series Key" }).click();

      await expect(page).toHaveURL(/time_period=2020-Q1/);
      await expect(page).toHaveURL(/dimensions=L_MEASURE%3AF/);
      await expect(page).toHaveURL(/view=seriesKey/);
      await expect(page.getByRole("main")).toContainText("FX and break adjusted change (BIS calculated)");
      await expect(page.getByRole("main")).toContainText("View:Series Key");
    });

    await it.step(`3. Open the Share dialog`, async () => {
      await page.getByRole("button", { name: "Share" }).click();
      await expect(page.getByRole("dialog", { name: "Share" })).toBeAttached();
      await expect(page.getByRole("dialog", { name: "Share" }).getByRole("textbox", { name: "URL" })).toBeVisible();
    });

    await it.step(`4. Copy/share controls expose a reusable URL`, async () => {
      const shareDialog = page.getByRole("dialog", { name: "Share" });
      const shareUrl = shareDialog.getByRole("textbox", { name: "URL" });
      await expect(shareUrl).toHaveValue(/BIS,LBS_A1,1\.0/);
      await expect(shareUrl).toHaveValue(/time_period=2020-Q1/);
      await expect(shareUrl).toHaveValue(/dimensions=L_MEASURE%3AF/);
      await expect(shareUrl).toHaveValue(/view=seriesKey/);
      await shareDialog.getByRole("button", { name: "Copy to clipboard" }).click();
      const sharedUrlValue = await shareUrl.inputValue();
      const sharedPage = await page.context().newPage();
      await sharedPage.goto(sharedUrlValue);
      await sharedPage.waitForLoadState("domcontentloaded");
      await expect(sharedPage).toHaveURL(/BIS,LBS_A1,1\.0/);
      await expect(sharedPage.getByRole("combobox", { name: "publication table date" })).toHaveValue("2020-Q1");
      await expect(sharedPage.getByRole("main")).toContainText("FX and break adjusted change (BIS calculated)");
      await expect(sharedPage.getByRole("main")).toContainText("View:Series Key");
      await sharedPage.close();
    });
  });
});
