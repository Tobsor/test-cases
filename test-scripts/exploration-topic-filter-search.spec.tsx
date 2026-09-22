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

async function openExploreDialog(page: Page): Promise<Locator> {
  await page.locator("main").getByRole("button", { name: "Explore" }).click();
  const dialog = page.getByRole("dialog", { name: "Explore" });
  await expect(dialog.getByRole("region", { name: "Exploration panel" })).toBeVisible();
  return dialog;
}

async function selectBorrowersPane(dialog: Locator): Promise<void> {
  await dialog.getByRole("menuitem", { name: "Credit", exact: true }).click();
  await dialog.getByRole("menuitem", { name: "Debt service ratios" }).click();
  await dialog.getByRole("menuitem", { name: "Borrowers", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "Non-financial corporations[N]" })).toBeVisible();
}

async function expectBorrowerChecked(dialog: Locator, borrowerName: RegExp, checked: boolean): Promise<void> {
  const label = dialog.locator("label").filter({ hasText: borrowerName }).first();
  const inputId = await label.getAttribute("for");
  if (!inputId) {
    throw new Error("Borrower option label is missing an associated input");
  }
  if (checked) {
    await expect(dialog.locator(`#${inputId}`)).toBeChecked();
  } else {
    await expect(dialog.locator(`#${inputId}`)).not.toBeChecked();
  }
}

async function expectAllBorrowerOptionsChecked(dialog: Locator, checked: boolean): Promise<void> {
  for (const borrowerName of [/Households & NPISHs\[H\]/, /Non-financial corporations\[N\]/, /Private non-financial sector\[P\]/]) {
    await expectBorrowerChecked(dialog, borrowerName, checked);
  }
}

const it = test;

test.describe(`Exploration Topic Filter Search`, () => {
  test(`Exploration Topic Filter Search`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Click the button "Explore" embedded to the right side within the search bar`, async () => {
      await openExploreDialog(page);
    });

    await it.step(`3. Select the item "Credit" in the left Pane`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("menuitem", { name: "Credit" }).click();
      await expect(dialog.getByRole("menuitem", { name: "Credit", exact: true })).toBeVisible();
      await expect(dialog.getByRole("menuitem", { name: "Debt service ratios" })).toBeVisible();
    });

    await it.step(`4. Select the item "Debt service ratios" in the next Pane`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("menuitem", { name: "Debt service ratios" }).click();
      await expect(dialog.getByRole("menuitem", { name: "Borrowers", exact: true })).toBeVisible();
      await expect(dialog.getByRole("link", { name: /Show \d+ results/ })).toBeVisible();
    });

    await it.step(`5. Select the item "Borrowers" in the next Pane`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("menuitem", { name: "Borrowers", exact: true }).click();
      await expect(dialog.getByRole("checkbox", { name: "Non-financial corporations[N]" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Select all" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Reset" }).last()).toBeDisabled();
      await expect(dialog.getByText(/Sort by Code|Search/i).first()).toBeVisible();
    });

    await it.step(`6. Check the checkbox next to "Non-financial corporations" by clicking it`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      const option = dialog.getByRole("option", { name: /^Non-financial corporations\[N\]/ });
      const countChip = option.locator('[aria-label="Chip"]');
      await expect(countChip).toHaveText(/^\d+$/);
      const expectedResultCount = Number(await countChip.innerText());
      const checkbox = option.getByRole("checkbox", {
        name: "Non-financial corporations[N]",
      });
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(dialog.getByRole("link", { name: `Show ${expectedResultCount} results`, exact: true })).toBeVisible();
    });

    await it.step(`7. Click on Reset (next to "Show x results")`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("button", { name: "Reset" }).first().click();
      await expect(dialog.getByRole("link", { name: /Show \d+ results/ })).toBeVisible();
      await expect(dialog.getByRole("checkbox", { name: "Non-financial corporations[N]" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Reset" }).first()).toBeDisabled();
    });

    await it.step(`8. Repeat Step 5`, async () => {
      await selectBorrowersPane(page.getByRole("dialog", { name: "Explore" }));
    });

    await it.step(`9. Click on Select all`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      const borrowerOptions = dialog.getByRole("listbox").getByRole("option");
      await expect(borrowerOptions).toHaveCount(3);
      const expectedSelectedCount = await borrowerOptions.count();
      await dialog.getByRole("button", { name: "Select all" }).click();
      await expectAllBorrowerOptionsChecked(dialog, true);
      await expect(dialog.getByRole("menuitem", { name: /^Borrowers(?:\s|$)/ })
        .getByText(String(expectedSelectedCount), { exact: true })).toBeVisible();
      await expect(dialog.getByRole("link", { name: /Show \d+ results/ })).toBeVisible();
    });

    await it.step(`10. Click on Reset (above the filter items)`, async () => {
      const dialog = page.getByRole("dialog", { name: "Explore" });
      await dialog.getByRole("button", { name: "Reset" }).last().click();
      await expectAllBorrowerOptionsChecked(dialog, false);
      await expect(dialog.getByRole("button", { name: "Reset" }).last()).toBeDisabled();
      await expect(dialog.getByRole("link", { name: /Show \d+ results/ })).toBeVisible();
    });

    await it.step(`11. Click on "Non-financial corporations"`, async () => {
      const checkbox = page.getByRole("dialog", { name: "Explore" }).getByRole("checkbox", {
        name: "Non-financial corporations[N]",
      });
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(page.getByRole("dialog", { name: "Explore" }).locator('a[href*="DSR_BORROWERS%3DN"]')).toBeVisible();
    });

    await it.step(`12. Press on the button labelled "Show X results"`, async () => {
      await page.getByRole("dialog", { name: "Explore" }).locator('a[href*="DSR_BORROWERS%3DN"]').click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/search\?filter=_CATEGORY%3DDSR%255EDSR_BORROWERS%3DN/);
      const filters = page.getByRole("region", { name: "Filters", exact: true });
      await expect(filters.getByRole("button", { name: /^Topic filter / })).toHaveText("Topic: Debt service ratios [DSR]");
      await expect(filters.getByRole("button", { name: "Clear Topic filter", exact: true })).toBeVisible();
      await expect(filters.getByRole("button", { name: /^Borrowers filter / })).toHaveText("Borrowers: Non-financial corporations [N]");
      await expect(filters.getByRole("button", { name: "Clear Borrowers filter", exact: true })).toBeVisible();

      const results = page.getByRole("region", { name: "Time series list", exact: true }).getByRole("article");
      for (let index = 0; index < 5; index += 1) {
        // Individual series use the singular "Debt service ratio" in their titles.
        await expect(results.nth(index).getByRole("link", { name: /\bDebt service ratios?\b/i })).toBeVisible();
      }
    });
  });
});
