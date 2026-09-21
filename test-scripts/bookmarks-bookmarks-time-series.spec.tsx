import { expect, test, type Page } from "@playwright/test";

// Local test helpers. Kept inline so this spec has no project-local runtime imports.
const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, pathOrUrl: string): Promise<void> {
  const url = normalizeUrl(pathOrUrl);
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
}

function normalizeUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    return `${BASE_URL}${url.pathname}${url.search}${url.hash}`;
  }

  if (!pathOrUrl.startsWith("/")) {
    return `${BASE_URL}/${pathOrUrl}`;
  }

  return `${BASE_URL}${pathOrUrl}`;
}

async function openBookmarksPanel(page: Page): Promise<void> {
  const bookmarksButton = page.getByRole("button", { name: "Bookmarks" });
  await expect(bookmarksButton, "Header bookmarks button should be available").toBeVisible();
  await bookmarksButton.click();
  await expect(page.getByRole("dialog", { name: "Bookmarks" }), "Bookmarks panel should open").toBeAttached();
  await expect(page.getByRole("button", { name: "Close modal" }), "Bookmarks panel close button should be available").toBeVisible();
}

async function closeBookmarksPanel(page: Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: "Close modal" });
  await expect(closeButton, "Bookmarks panel close button should be available").toBeVisible();
  await closeButton.click();
  await expect(closeButton, "Bookmarks panel should close").toBeHidden();
}

async function clickBookmarkButton(page: Page): Promise<void> {
  const button = page.locator("main").getByRole("button", { name: "Bookmark", exact: true });
  await expect(button, "Bookmark button should be enabled").toBeEnabled();
  await button.click({ timeout: 15_000 });
}

function bookmarksDialog(page: Page) {
  return page.getByRole("dialog", { name: "Bookmarks" });
}

function timeSeriesPanel(page: Page) {
  return bookmarksDialog(page).getByRole("tabpanel", { name: "Time series" });
}

async function clickByRoleOrText(
  page: Page,
  name: string | RegExp,
  roles: Array<"button" | "link" | "option" | "tab" | "checkbox" | "switch" | "menuitem" | "radio"> = [
    "button",
    "link",
    "option",
    "tab",
    "checkbox",
    "switch",
    "menuitem",
    "radio",
  ],
): Promise<void> {
  const scope = page.locator("main").or(page.getByRole("menu")).or(page.getByRole("dialog"));
  const target = roles
    .map((role) => scope.getByRole(role, { name }).first())
    .reduce((combined, locator) => combined.or(locator))
    .first();

  await expect(target, `Strict role target was not found: ${String(name)}`).toBeVisible({ timeout: 3_000 });
  await target.click({ timeout: 3_000 });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const it = test;

test.describe(`Bookmarks Bookmarks time series`, () => {
  test(`Bookmarks Bookmarks time series`, async ({ page }) => {
    await it.step(`1. Navigate to \`/topics/LBS/data\``, async () => {
      await gotoPath(page, "/topics/LBS/data");
    });

    await it.step(`2. Click the bookmarks button in the header`, async () => {
      await openBookmarksPanel(page);
      await expect(bookmarksDialog(page).getByRole("tab", { name: "Time series" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(timeSeriesPanel(page).getByText(/No bookmarks saved yet/i)).toBeVisible();
    });

    await it.step(`3. Close the modal by clicking on X or in the overlay`, async () => {
      await closeBookmarksPanel(page);
    });

    await it.step(`4. Check a time series in the time series list`, async () => {
      const checkbox = page.locator("main").getByRole("checkbox", { name: /select time series/i }).first();
      await expect(checkbox, "Time series checkbox should be available").toBeVisible();
      await checkbox.click();
    });

    await it.step(`5. Click on \`Bookmark\` button`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Time series added to bookmarks/i)).toBeVisible();
    });

    await it.step(`6. Click the bookmarks button in the header`, async () => {
      await openBookmarksPanel(page);
      await expect(bookmarksDialog(page).getByRole("tab", { name: "Time series" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(timeSeriesPanel(page).getByRole("article").first()).toBeVisible();
    });

    await it.step(`7. Close the modal by clicking on X or in the overlay`, async () => {
      await closeBookmarksPanel(page);
    });

    await it.step(`8. Click on another time series`, async () => {
      const secondSeriesLink = page.locator("main article").getByRole("link").nth(1);
      await expect(secondSeriesLink, "Another time series link should be available").toBeVisible();
      await secondSeriesLink.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/LBS\/BIS,WS_LBS_D_PUB,1\.0\//);
    });

    await it.step(`9. Repeat step 5 to 7`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Time series added to bookmarks/i)).toBeVisible();
      await openBookmarksPanel(page);
      await expect(timeSeriesPanel(page).getByRole("article").first()).toBeVisible();
      await closeBookmarksPanel(page);
    });

    await it.step(`10. Click on \`Bookmark\` button again`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Time series updated in bookmarks/i)).toBeVisible();
    });

    await it.step(`11. Navigate to \`/topics/LBS/data\``, async () => {
      await gotoPath(page, "/topics/LBS/data");
    });

    await it.step(`12. Check 3 time series (one which is already bookmarked, two which are not bookmarked yet)`, async () => {
      const checkboxes = page.locator("main").getByRole("checkbox", { name: /select time series/i });
      for (const index of [0, 2, 3]) {
        await expect(checkboxes.nth(index), `Time series checkbox ${index + 1} should be available`).toBeVisible();
        await checkboxes.nth(index).click();
      }
    });

    await it.step(`13. Click on \`Bookmark\` button`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/2 Time series added to bookmarks and 1 updated/i)).toBeVisible();
    });

    await it.step(`14. Repeat step 6`, async () => {
      await openBookmarksPanel(page);
      await expect(bookmarksDialog(page).getByRole("tab", { name: "Time series" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(timeSeriesPanel(page).getByRole("article")).toHaveCount(4);
    });
  });
});
