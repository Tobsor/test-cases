import { expect, test, type Page } from "@playwright/test";

const SAMPLE_TABLE_TITLE =
  "Summary of locational statistics, by currency, instrument and residence and sector of counterparty, Amounts outstanding";

async function gotoLbsData(page: Page): Promise<void> {
  await page.goto("/topics/LBS/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Locational banking statistics" })).toBeVisible();
}

async function openBookmarksPanel(page: Page) {
  await page.getByRole("button", { name: "Bookmarks" }).click();

  const dialog = page.getByRole("dialog", { name: "Bookmarks" });
  await expect(dialog).toBeAttached();
  await expect(dialog.getByRole("tab", { name: "Time series" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Tables" })).toBeVisible();

  return dialog;
}

async function closeBookmarksPanel(page: Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: "Close modal" });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(closeButton).toBeHidden();
}

function main(page: Page) {
  return page.locator("main");
}

function sampleTablesSection(page: Page) {
  return main(page).getByRole("region", { name: "Sample tables" });
}

function bookmarksDialog(page: Page) {
  return page.getByRole("dialog", { name: "Bookmarks" });
}

function tablesPanel(page: Page) {
  return bookmarksDialog(page).getByRole("tabpanel", { name: "Tables" });
}

async function clickBookmarkButton(page: Page): Promise<void> {
  const button = main(page).getByRole("button", { name: "Bookmark", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}

const it = test;

test.describe("Bookmarks Bookmark sample table", () => {
  test("Bookmarks Bookmark sample table", async ({ page }) => {
    await it.step("1. Navigate to `/topics/LBS/data`", async () => {
      await gotoLbsData(page);
    });

    await it.step("2. Expand the sample tables section", async () => {
      const sampleTables = sampleTablesSection(page);
      await expect(sampleTables).toBeVisible();
      await expect(sampleTables.getByText(/Build your own table starting from one of the templates/i)).toBeVisible();
    });

    await it.step("3. Click on the first item card", async () => {
      const firstSampleTable = sampleTablesSection(page).locator('a[href="/topics/LBS/data/BIS,PDQ_A1_S,1.0"]');
      await expect(firstSampleTable).toBeVisible();
      await expect(firstSampleTable.getByRole("heading", { level: 3, name: new RegExp(SAMPLE_TABLE_TITLE, "i") })).toBeVisible();

      await firstSampleTable.click();
      await page.waitForLoadState("domcontentloaded");

      await expect(page).toHaveURL((url) => {
        return (
          url.pathname === "/topics/LBS/data" &&
          Boolean(url.searchParams.get("pdqId")) &&
          url.searchParams.get("data_view") === "table" &&
          Boolean(url.searchParams.get("filter"))
        );
      });
      await expect(main(page).getByRole("heading", { level: 1, name: SAMPLE_TABLE_TITLE })).toBeVisible();
      await expect(main(page).getByRole("radio", { name: "Table" })).toBeChecked();
      await expect(main(page).getByText(/time series found/i)).toBeVisible();
      await expect(main(page).getByRole("treegrid")).toBeVisible();
      await expect(main(page).getByRole("gridcell", { name: "US dollar" }).first()).toBeVisible();
    });

    await it.step("4. Click the bookmarks button in the header", async () => {
      const dialog = await openBookmarksPanel(page);
      await expect(dialog.getByRole("tab", { name: "Time series" })).toHaveAttribute("aria-selected", "true");
    });

    await it.step("5. Click on the tables tab button", async () => {
      const tablesTab = bookmarksDialog(page).getByRole("tab", { name: "Tables" });
      await tablesTab.click();
      await expect(tablesTab).toHaveAttribute("aria-selected", "true");
      await expect(tablesPanel(page).getByText(/No bookmarks saved yet/i)).toBeVisible();
    });

    await it.step("6. Close the modal by clicking on X or in the overlay", async () => {
      await closeBookmarksPanel(page);
    });

    await it.step("7. Click on `Bookmark` button", async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Table added to bookmarks/i)).toBeVisible();
    });

    await it.step("8. Click the bookmarks button in the header", async () => {
      await openBookmarksPanel(page);
      await expect(bookmarksDialog(page).getByRole("tab", { name: "Tables" })).toHaveAttribute("aria-selected", "true");
      await expect(tablesPanel(page).getByText("1 bookmark")).toBeVisible();
      await expect(tablesPanel(page).getByRole("article").first()).toContainText(SAMPLE_TABLE_TITLE);
      await expect(tablesPanel(page).getByRole("article").first()).not.toContainText(/Build your own table starting from one of the templates/i);
      await expect(tablesPanel(page).getByRole("button", { name: "Rename bookmark" })).toBeVisible();
      await expect(tablesPanel(page).getByRole("checkbox", { name: "Select table" })).toBeVisible();
    });

    await it.step("9. Close the modal by clicking on X or in the overlay", async () => {
      await closeBookmarksPanel(page);
    });

    await it.step("10. Click on `Bookmark` button again", async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Table updated in bookmarks/i)).toBeVisible();
    });
  });
});
