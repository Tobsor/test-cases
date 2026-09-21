import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Load empty CPMI publication table after using link`, () => {
  test(`Load empty CPMI publication table after using link`, async ({ page }) => {
    let latestObservationYear = new Date().getFullYear();

    await it.step(`1. Go to the CPMI T11 publication table`, async () => {
      await gotoPath(page, "/topics/CPMI_FMI/tables-and-dashboards/BIS,CPMI_T11,1.0");
      await expect(page.getByRole("heading", { name: /T11: SWIFT message flows/i })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Reporting country" })).toBeVisible();
      await expect(page.getByRole("grid")).toBeVisible();
    });

    await it.step(`2. Select Belgium in Reporting country`, async () => {
      const country = page.getByRole("combobox", { name: "Reporting country" });
      await country.click();
      await country.fill("Belgium");
      await page.getByRole("option", { name: "Belgium" }).click();
      await expect(page.locator("main")).toContainText("Reporting country:Belgium");
      await expect(page.getByRole("grid")).toContainText("2024");
    });

    await it.step(`3. Click the first observation link`, async () => {
      const observation = page.getByRole("grid").getByRole("link").first();
      await expect(observation).toBeVisible();
      await observation.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/CPMI_FMI\/BIS,WS_CPMI_SYSTEMS,1\.0\//);
      await expect(page.locator("main")).toContainText(/2024|2023|2022/);
    });

    await it.step(`4. Verify the year of the latest shown observation in the graph`, async () => {
      const detailText = await page.locator("main").innerText();
      const years = [...detailText.matchAll(/\b20\d{2}\b/g)].map((match) => Number(match[0]));
      latestObservationYear = Math.max(...years);
      expect(latestObservationYear).toBeGreaterThan(2000);
      await expect(page.locator("main")).toContainText(String(latestObservationYear));
    });

    await it.step(`5. Back to Tables returns to the publication table`, async () => {
      await page.getByRole("link", { name: /Back to Tables/i }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/BIS,CPMI_T11,1\.0/);
      await expect(page.getByRole("grid")).toBeVisible();
      await expect(page.locator("main")).toContainText("Reporting country:Belgium");
    });

    await it.step(`6. Change table to T12 clears incompatible country state and loads an empty table safely`, async () => {
      const changeTable = page.getByRole("combobox", { name: "Change publication table" });
      await changeTable.click();
      await page.getByRole("option", { name: /T12: Number of clearing members/i }).click();
      await page.waitForLoadState("domcontentloaded");

      await expect(page).toHaveURL(/BIS(?:,|%2C)CPMI_T12(?:,|%2C)1\.0/);
      await expect(page.getByRole("heading", { name: /T12: Number of clearing members/i })).toBeVisible();
      await expect(page.getByRole("grid")).toBeVisible();
      await expect(page.locator("main")).toContainText("Year");
      for (const year of Array.from({ length: 5 }, (_, index) => String(latestObservationYear - index))) {
        await expect(page.locator("main")).toContainText(year);
      }
      await expect(page.locator("main")).not.toContainText("Reporting country:Belgium");
      await expect(page.getByRole("combobox", { name: "Reporting country" })).toHaveValue("");
      await expect(page.getByRole("grid").getByRole("link")).toHaveCount(0);
    });
  });
});
