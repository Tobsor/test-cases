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

function bookmarkTitleInput(page: Page) {
  return page.getByRole("textbox", { name: /Title/i });
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

test.describe(`Bookmarks Rename a time series bookmark`, () => {
  test(`Bookmarks Rename a time series bookmark`, async ({ page }) => {
    await it.step(`1. Navigate to \`/topics/LBS/data\``, async () => {
      await gotoPath(page, "/topics/LBS/data");
    });

    await it.step(`2. Check the first time series in the time series list`, async () => {
      const checkbox = page.locator("main").getByRole("checkbox", { name: /select time series/i }).first();
      await expect(checkbox, "Time series checkbox should be available").toBeVisible();
      await checkbox.click();
    });

    await it.step(`3. Click on \`Bookmark\` button`, async () => {
      await clickBookmarkButton(page);
      await expect(page.getByText(/1 Time series added to bookmarks/i)).toBeVisible();
    });

    await it.step(`4. Click the bookmarks button in the header`, async () => {
      await openBookmarksPanel(page);
      await expect(page.getByRole("tab", { name: "Time series" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel", { name: "Time series" }).getByRole("article").first()).toBeVisible();
    });

    await it.step(`5. Click on the 3 dots icon button in the line of the bookmarked time series`, async () => {
      await page.getByRole("button", { name: "Menu collapsed, click to expand" }).click();
      await expect(page.getByRole("menuitem", { name: "Show metadata" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Rename bookmark" })).toBeVisible();
    });

    await it.step(`6. Click on \`Rename\` link`, async () => {
      await page.getByRole("menuitem", { name: "Rename bookmark" }).click();
      await expect(bookmarkTitleInput(page), "Bookmark title input should be available").toBeVisible();
      await expect(bookmarkTitleInput(page), "Bookmark title input should contain the original name").not.toHaveValue("");
    });

    await it.step(`7. Remove the text`, async () => {
      await bookmarkTitleInput(page).clear();
    });

    await it.step(`8. Click on \`Save\` button`, async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(bookmarkTitleInput(page), "Bookmark title input should remain available").toBeVisible();
      await expect(page.getByText(/Field is required/i)).toBeVisible();
    });

    await it.step(`9. Add the following text in the input field: "Custom bookmark name"`, async () => {
      await bookmarkTitleInput(page).fill("Custom bookmark name");
    });

    await it.step(`10. Click on \`Save\` button`, async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(bookmarkTitleInput(page), "Rename modal should close after saving").toBeHidden();
      await expect(page.getByText("Custom bookmark name", { exact: true })).toBeVisible();
    });
  });
});
