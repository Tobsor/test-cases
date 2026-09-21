import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  await page.waitForLoadState("domcontentloaded");
}

async function openBookmarksPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Bookmarks" }).click();
  await expect(page.getByRole("dialog", { name: "Bookmarks" })).toBeAttached();
  await expect(page.getByRole("tab", { name: "Time series" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tables" })).toBeVisible();
}

async function closeBookmarksPanel(page: Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: "Close modal" });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(closeButton).toBeHidden();
}

async function clickBookmarkButton(page: Page): Promise<void> {
  const button = page.locator("main").getByRole("button", { name: "Bookmark", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}

function bookmarksDialog(page: Page) {
  return page.getByRole("dialog", { name: "Bookmarks" });
}

function tablesPanel(page: Page) {
  return bookmarksDialog(page).getByRole("tabpanel", { name: "Tables" });
}

const it = test;

test.describe(`Bookmarks Bookmark publication table`, () => {
  test(`Bookmarks Bookmark publication table`, async ({ page }) => {
    await it.step(`1. Navigate to the LBS tables overview`, async () => {
      await gotoPath(page, "/topics/LBS/tables-and-dashboards");
    });

    await it.step(`2. Open the A1 publication table`, async () => {
      await page.locator('main a[href="/topics/LBS/tables-and-dashboards/BIS,LBS_A1,1.0"]').click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/BIS,LBS_A1,1\.0$/);
    });

    await it.step(`3. Bookmarks modal opens and exposes the Tables tab`, async () => {
      await openBookmarksPanel(page);
      await expect(bookmarksDialog(page).getByRole("tab", { name: "Time series" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      const tablesTab = bookmarksDialog(page).getByRole("tab", { name: "Tables" });
      await tablesTab.click();
      await expect(tablesTab).toHaveAttribute("aria-selected", "true");
      await expect(tablesPanel(page).getByText(/No bookmarks saved yet/i)).toBeVisible();
    });

    await it.step(`4. Close the modal by clicking on X or in the overlay`, async () => {
      await closeBookmarksPanel(page);
    });

    await it.step(`5. Bookmark the publication table`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Table added to bookmarks/i)).toBeVisible();
    });

    await it.step(`6. Bookmarks modal can be reopened after bookmarking`, async () => {
      await openBookmarksPanel(page);
      await expect(bookmarksDialog(page).getByRole("tab", { name: "Tables" })).toHaveAttribute("aria-selected", "true");
      await expect(tablesPanel(page).getByRole("article").first()).toContainText(/A1|Amounts outstanding/i);
      await expect(tablesPanel(page).getByRole("article").first()).toContainText(/Locational banking statistics|Table/i);
      await closeBookmarksPanel(page);
    });

    await it.step(`10. Bookmark button can update the saved publication table`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Table updated in bookmarks/i)).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: "Bookmark", exact: true })).toBeEnabled();
    });
  });
});
