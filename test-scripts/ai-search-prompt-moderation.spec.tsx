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

async function submitResultSearch(page: Page, term: string): Promise<void> {
  const input = page.locator("main").getByRole("combobox", { name: /search for time series|search/i }).first();
  await expect(input, "Result search input should be available before typing").toBeVisible();
  await input.click();
  await input.clear();
  await input.pressSequentially(term);
  await input.press("Enter");
  await expect(page).toHaveURL(/[?&]q=/i);
}

async function ensureAiSearchEnabled(page: Page): Promise<void> {
  const toggle = page.getByRole("switch", { name: "Toggle AI-Search feature" });
  await expect(toggle, "AI toggle should be available").toBeVisible();

  if (await toggle.isChecked()) {
    return;
  }

  await toggle.click();
  await page.getByRole("button", { name: /^Agree$/i }).click();
  await expect(toggle, "AI toggle should be enabled").toBeChecked();
}

function main(page: Page) {
  return page.locator("main");
}

async function expectInitialAiSuggestionPrompt(page: Page): Promise<void> {
  await expect(main(page).getByText(/AI-assisted time series suggestions/i)).toBeVisible();
  await expect(main(page).getByText(/Provide a query to generate AI supported suggestions/i)).toBeVisible();
  await expect(main(page).getByRole("button", { name: /show reasoning/i })).toBeVisible();
}

async function expectModerationFailure(page: Page): Promise<void> {
  await expect(main(page).getByText(/did not pass the moderation step of the BIS Data Portal/i)).toBeVisible();
  await expect(main(page).getByText(/directly related to BIS statistics/i)).toBeVisible();
  await expect(main(page).getByRole("button", { name: /show reasoning/i })).toBeDisabled();
  await expect(main(page).getByText(/0 time series found/i)).toBeVisible();
}

const it = test;

test.describe(`AI Search Prompt Moderation`, () => {
  test(`AI Search Prompt Moderation`, async ({ page }) => {
    await it.step(`1. Go to \`/search\``, async () => {
      await gotoPath(page, "/search");
      await ensureAiSearchEnabled(page);
    });

    await it.step(`2. Verify that the AI-Toggle is enabled or enable it if it wasn't`, async () => {
      await ensureAiSearchEnabled(page);
      await expectInitialAiSuggestionPrompt(page);
    });

    await it.step(`4. Enter the term "Who is Mickey Mouse?"`, async () => {
      await submitResultSearch(page, "Who is Mickey Mouse?");
      await expectModerationFailure(page);
    });

    await it.step(`5. Enter the term "How bad is the inflation in Switzerland?"`, async () => {
      await submitResultSearch(page, "How bad is the inflation in Switzerland?");
      await expectModerationFailure(page);
    });
  });
});
