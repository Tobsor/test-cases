import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Navigating to inexisting publication table`, () => {
  test(`Navigating to inexisting publication table`, async ({ page }) => {
    await it.step(`1. Go to the DSS topic page`, async () => {
      await gotoPath(page, "/topics/DSS");
      await expect(page.getByRole("heading", { name: "Debt securities statistics", level: 1 })).toBeVisible();
    });

    await it.step(`2. Open Tables & dashboards from topic navigation`, async () => {
      await page.getByRole("navigation", { name: "Page navigation" }).getByRole("link", { name: "Tables & dashboards" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/DSS\/tables-and-dashboards$/);
    });

    await it.step(`3. Select the Country tab`, async () => {
      const tables = page.locator("main").getByRole("region", { name: "Tables" });
      await tables.getByRole("tab", { name: "Country" }).click();
      await expect(tables.getByRole("tab", { name: "Country" })).toHaveAttribute("aria-selected", "true");
      await expect(
        tables.locator('a[href="/topics/DSS/tables-and-dashboards/BIS,SEC_C5_LOCAL,1.0"]'),
      ).toBeVisible();
    });

    await it.step(`4. Select C5 and filter to Euro area`, async () => {
      await page.locator('main a[href="/topics/DSS/tables-and-dashboards/BIS,SEC_C5_LOCAL,1.0"]').click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/BIS,SEC_C5_LOCAL,1\.0/);
      const issuerResidence = page.getByRole("combobox", { name: /Issuer residence|Reference area/ }).first();
      await issuerResidence.click();
      await issuerResidence.fill("Euro area");
      await page.getByRole("option", { name: /Euro area .*changing composition/ }).click();
      await expect(page.locator("main")).toContainText(/Euro area .*changing composition/);
      await expect(page.getByRole("grid").getByRole("link", { name: /International debt securities amounts outstanding/i })).toBeVisible();
    });

    await it.step(`5. Linked IDS table loads as an empty table with headers and cleared filter`, async () => {
      await page.getByRole("grid").getByRole("link", { name: /International debt securities amounts outstanding/i }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/BIS,SEC_C5_IDS,1\.0.*ISSUER_RES:U2/);
      await expect(page.getByRole("grid")).toBeVisible();
      await expect(page.locator("main")).toContainText("Issuer residence");
      await expect(page.locator("main")).toContainText("Residents (S1)");
      await expect(page.getByRole("combobox", { name: /Issuer residence|Reference area/ }).first()).toHaveValue("");
      await expect(page.getByRole("grid").getByRole("link")).toHaveCount(0);
    });
  });
});
