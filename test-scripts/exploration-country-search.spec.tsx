import { expect, test, type Locator, type Page } from "@playwright/test";

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

  return pathOrUrl.startsWith("/") ? `${BASE_URL}${pathOrUrl}` : `${BASE_URL}/${pathOrUrl}`;
}

function mainSearchInput(page: Page): Locator {
  return page.locator("main").getByRole("combobox", { name: "Search for time series" });
}

async function openExploreDialog(page: Page): Promise<Locator> {
  await page.locator("main").getByRole("button", { name: "Explore" }).click();
  const dialog = page.getByRole("dialog", { name: "Explore" });
  await expect(dialog.getByRole("region", { name: "Exploration panel" })).toBeVisible();
  return dialog;
}

const it = test;

test.describe(`Exploration Country search`, () => {
  test(`Exploration Country search`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Click on the button "Explore" embedded on the right side of the search bar`, async () => {
      const dialog = await openExploreDialog(page);
      await expect(dialog.getByRole("tab", { name: "Topics" })).toHaveAttribute("aria-selected", "true");
      await expect(dialog.getByRole("tab", { name: "Countries" })).toBeVisible();
    });

    await it.step(`3. Click on the Tab navigation button "Countries" in the upper left corner of the explore fly out menu`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("tab", { name: "Countries" }).click();
      await expect(dialog.getByRole("tab", { name: "Countries" })).toHaveAttribute("aria-selected", "true");
      await expect(dialog.getByRole("textbox", { name: "Search for countries" })).toBeVisible();
    });

    await it.step(`4. Click on the letter "G" on the alphabet which is horizontally lined on the upper part of the fly out menu`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("tab", { name: "G", exact: true }).click();
      await expect(dialog.getByRole("tabpanel", { name: "G" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Germany" })).toBeVisible();
    });

    await it.step(`5. Click into the input field and type "Germany"`, async () => {
      const countrySearch = page.getByRole("dialog", { name: "Explore" }).getByRole("textbox", { name: "Search for countries" });
      await countrySearch.fill("Germany");
      await expect(countrySearch).toHaveValue("Germany");
      await expect(page.getByRole("dialog", { name: "Explore" }).getByRole("link", { name: "Germany" })).toBeVisible();
    });

    await it.step(`6. Click on the link "Germany"`, async () => {
      await page.getByRole("dialog", { name: "Explore" }).getByRole("link", { name: "Germany" }).click();
      await page.waitForLoadState("domcontentloaded");
    });

    await it.step(`Expected 1. The user should be redirected to \`/search\``, async () => {
      await expect(page).toHaveURL(/\/search\?q=Germany$/);
    });

    await it.step(`Expected 2. The items should relate to the term "Germany"`, async () => {
      await expect(page.getByText(/time series found/i)).toBeVisible();
      await expect(page.getByText(/Germany/i).first()).toBeVisible();
    });

    await it.step(`Expected 3. The search bar on top of the page should have the value "Germany" set`, async () => {
      await expect(mainSearchInput(page)).toHaveValue("Germany");
    });
  });
});
