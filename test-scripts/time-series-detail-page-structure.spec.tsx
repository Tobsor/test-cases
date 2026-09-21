import { expect, test, type Page } from "@playwright/test";

async function gotoDetail(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
}

function main(page: Page) {
  return page.locator("main");
}

async function expectCommonDetailChrome(page: Page): Promise<void> {
  await expect(main(page).getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Bookmark" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Share" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Export" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "1Y" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "5Y" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "All" })).toBeVisible();
  await expect(main(page).getByRole("radiogroup", { name: "view-switch" })).toBeVisible();
  await expect(main(page).getByRole("radio", { name: "Chart" })).toBeChecked();
  await expect(main(page).getByRole("radio", { name: "Observations" })).toBeVisible();
  await expect(main(page).getByRole("region", { name: "Chart" })).toBeVisible();
  await expect(main(page).getByRole("region", { name: "Time series list" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Add time series" })).toBeVisible();
}

test.describe("Time Series Detail Page Structure", () => {
  test("renders detail page metadata, views, chart, and dimensions", async ({ page }) => {
    await test.step("opens central bank policy rates detail page", async () => {
      await gotoDetail(page, "/topics/CBPOL/BIS,WS_CBPOL,1.0/M.BR");

      await expect(page).toHaveTitle(/Central bank policy rates, Brazil/);
      await expect(page.getByRole("heading", { level: 1, name: "Central bank policy rates, Brazil" })).toBeVisible();
      await expect(main(page).getByText("Series key")).toBeVisible();
      await expect(main(page).getByText("M.BR").first()).toBeVisible();
      await expect(main(page).getByText("Data flow ID")).toBeVisible();
      await expect(main(page).getByText("BIS,WS_CBPOL,1.0").first()).toBeVisible();
      await expectCommonDetailChrome(page);
      await expect(main(page).getByRole("button", { name: /Frequency filter collapsed/i })).toContainText("Monthly [M]");
      await expect(main(page).getByRole("button", { name: /Reference area filter collapsed/i })).toContainText("Brazil [BR]");
    });

    await test.step("opens a locational banking statistics detail page", async () => {
      await gotoDetail(page, "/topics/LBS/BIS,WS_LBS_D_PUB,1.0/Q.S.C.A.TO1.A.5J.A.5A.A.5J.A");

      await expect(page.getByRole("heading", { level: 1 })).toContainText(/All reporting countries/i);
      await expect(main(page).getByRole("link", { name: "Locational banking statistics", exact: true })).toBeVisible();
      await expect(main(page).getByText("Q.S.C.A.TO1.A.5J.A.5A.A.5J.A").first()).toBeVisible();
      await expectCommonDetailChrome(page);
      await expect(main(page).getByRole("button", { name: /Frequency filter collapsed/i })).toContainText("Quarterly [Q]");
      await expect(
        main(page).getByRole("button", { name: "Reporting country filter collapsed, click to expand", exact: true }),
      ).toBeVisible();
      await expect(
        main(page).getByRole("button", { name: "Counterparty country filter collapsed, click to expand", exact: true }),
      ).toBeVisible();
    });
  });
});
