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

async function clickBookmarkButton(page: Page): Promise<void> {
  const button = page.locator("main").getByRole("button", { name: "Bookmark", exact: true });
  await expect(button, "Bookmark button should be enabled").toBeEnabled();
  await button.click({ timeout: 15_000 });
}

async function switchToTableView(page: Page): Promise<void> {
  const tableView = page.locator("main").getByRole("radio", { name: "Table" });
  await expect(tableView, "Table view switch should be available").toBeVisible();
  await tableView.check();
  await expect(tableView, "Table view should be selected").toBeChecked();
}

async function selectBookmarkedTable(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Tables" }).click();
  await expect(page.getByRole("tab", { name: "Tables" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Tables" }).getByRole("article").first()).toBeVisible();
  const checkbox = page.getByRole("checkbox", { name: /Select table|Select time series/ }).last();
  await expect(checkbox, "Bookmarked table checkbox should be available").toBeVisible();
  await checkbox.check();
  await expect(page.getByRole("checkbox", { name: /Unselect table|Unselect time series/ }).last(), "Bookmarked table should be selected").toBeChecked();
  await expect(page.getByRole("button", { name: "Remove bookmarks" })).toBeEnabled();
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

test.describe(`Bookmarks Delete a table bookmark`, () => {
  test(`Bookmarks Delete a table bookmark`, async ({ page }) => {
    await it.step(`1. Navigate to \`/topics/LBS/data\``, async () => {
      await gotoPath(page, "/topics/LBS/data");
    });

    await it.step(`2. Check the two first time series in the time series list`, async () => {
      const checkboxes = page.locator("main").getByRole("checkbox", { name: /select time series/i });
      await expect(checkboxes.nth(0), "First time series checkbox should be available").toBeVisible();
      await expect(checkboxes.nth(1), "Second time series checkbox should be available").toBeVisible();
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
    });

    await it.step(`3. Click on table in the switch view button`, async () => {
      await switchToTableView(page);
      await expect(page.locator("main").getByRole("grid")).toBeVisible();
      await expect(page.locator("main").getByText(/2 selected/i)).toBeVisible();
    });

    await it.step(`4. Click on \`Bookmark\` button`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Table added to bookmarks/i)).toBeVisible();
    });

    await it.step(`5. Click the bookmarks button in the header`, async () => {
      await openBookmarksPanel(page);
    });

    await it.step(`6. Check the bookmarked table`, async () => {
      await selectBookmarkedTable(page);
    });

    await it.step(`7. Click on \`Remove\` button in the toolbar`, async () => {
      await page.getByRole("button", { name: "Remove bookmarks" }).click();
      await expect(
        page.getByRole("tabpanel", { name: "Tables" }).getByRole("heading", { name: "No bookmarks saved yet" }),
        "Bookmark should be removed",
      ).toBeVisible();
      await expect(page.getByRole("tabpanel", { name: "Tables" }).getByRole("article")).toHaveCount(0);
    });
  });
});
