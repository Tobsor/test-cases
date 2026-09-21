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

async function waitForAiSuggestions(page: Page): Promise<void> {
  const panel = page.locator("main").getByText(/AI-assisted time series suggestions/i).first();
  await expect(panel, "AI-assisted suggestions panel should be visible").toBeVisible();
  const loading = page.locator("main").getByText(/Preparing suggestions|Loading/i).first();
  await expect(loading, "AI suggestions should finish loading before reasoning is shown").toBeHidden({ timeout: 30_000 });
  const reasoningButton = page.locator("main").getByRole("button", { name: /show reasoning/i }).first();
  await expect(reasoningButton, "Show reasoning should be enabled after AI suggestions load").toBeEnabled({ timeout: 30_000 });
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

function feedbackTitle(page: Page) {
  return page.getByText("Why wasn't this useful?", { exact: true });
}

function usefulButton(page: Page) {
  return page.locator("main").getByRole("button", { name: "Useful", exact: true });
}

function notUsefulButton(page: Page) {
  return page.locator("main").getByRole("button", { name: "Not useful", exact: true });
}

function incompleteFeedbackOption(page: Page) {
  return page.getByRole("checkbox", { name: "Incomplete" });
}

function feedbackReason(page: Page, name: string | RegExp) {
  return page.getByRole("checkbox", { name });
}

function feedbackSubmitButton(page: Page) {
  return page.getByRole("button", { name: /^Submit$/i });
}

function feedbackDetailsInput(page: Page) {
  return page.getByRole("textbox");
}

function feedbackThankYou(page: Page) {
  return page.getByText(/thank you|thanks/i).first();
}

async function expectFeedbackButtonsDisabled(page: Page): Promise<void> {
  await expect(usefulButton(page), "Useful feedback button should be visible").toBeVisible();
  await expect(notUsefulButton(page), "Not useful feedback button should be visible").toBeVisible();
  await expect(usefulButton(page), "Useful feedback button should be disabled").toBeDisabled();
  await expect(notUsefulButton(page), "Not useful feedback button should be disabled").toBeDisabled();
}

async function expectFeedbackButtonsEnabled(page: Page): Promise<void> {
  await expect(usefulButton(page), "Useful feedback button should be visible").toBeVisible();
  await expect(notUsefulButton(page), "Not useful feedback button should be visible").toBeVisible();
  await expect(usefulButton(page), "Useful feedback button should be enabled").toBeEnabled();
  await expect(notUsefulButton(page), "Not useful feedback button should be enabled").toBeEnabled();
}

async function expectLikedFeedbackState(page: Page): Promise<void> {
  await expect(usefulButton(page), "Useful button should remain visible after positive feedback").toBeVisible();
  await expect(usefulButton(page), "Useful button should become disabled after positive feedback").toBeDisabled();
  await expect(usefulButton(page), "Useful button should expose an active submitted state").toHaveClass(/submitted/);
  await expect(notUsefulButton(page), "Not useful button should disappear after positive feedback").toBeHidden();
  await expect(feedbackThankYou(page), "Thank-you notification should be visible after positive feedback").toBeVisible();
}

async function expectDislikedFeedbackState(page: Page): Promise<void> {
  await expect(notUsefulButton(page), "Not useful button should remain visible after negative feedback").toBeVisible();
  await expect(notUsefulButton(page), "Not useful button should become disabled after negative feedback").toBeDisabled();
  await expect(notUsefulButton(page), "Not useful button should expose an active submitted state").toHaveClass(/submitted/);
  await expect(usefulButton(page), "Useful button should disappear after negative feedback").toBeHidden();
  await expect(feedbackThankYou(page), "Thank-you notification should be visible after negative feedback").toBeVisible();
}

async function expectFeedbackDialogContents(page: Page): Promise<void> {
  await expect(feedbackTitle(page), "Feedback dialog should be open").toBeVisible();
  for (const reason of ["Incomplete", "Too generic", "Not clear enough", "Not what I was looking for", "Other"]) {
    await expect(feedbackReason(page, reason), `Feedback reason "${reason}" should be available`).toBeVisible();
  }
  await expect(feedbackDetailsInput(page), "Feedback dialog should expose a details text input").toBeVisible();
  await expect(feedbackSubmitButton(page), "Submit should be disabled before feedback is provided").toBeDisabled();
}

const it = test;

test.describe(`AI Search Feedback`, () => {
  test(`AI Search Feedback`, async ({ page }) => {
    await it.step(`1. Go to \`/search\``, async () => {
      await gotoPath(page, "/search");
      await ensureAiSearchEnabled(page);
      await expectFeedbackButtonsDisabled(page);
    });

    await it.step(`2. Enter the following search term and press enter: "What is the inflation rate in Switzerland?"`, async () => {
      await submitResultSearch(page, "What is the inflation rate in Switzerland?");
      await waitForAiSuggestions(page);
      await expectFeedbackButtonsEnabled(page);
    });

    await it.step(`3. Press on the like button`, async () => {
      await usefulButton(page).click();
      await expectLikedFeedbackState(page);
    });

    await it.step(`4. Enter the following search term press enter: "What is the inflation rate in Germany?"`, async () => {
      await submitResultSearch(page, "What is the inflation rate in Germany?");
      await waitForAiSuggestions(page);
      await expectFeedbackButtonsEnabled(page);
    });

    await it.step(`5. Click on the dislike button`, async () => {
      await notUsefulButton(page).click();
      await expectFeedbackDialogContents(page);
    });

    await it.step(`6. The following scenarios should lead to the submit button being enabled`, async () => {
      await expect(incompleteFeedbackOption(page), "Feedback dialog should expose selectable reasons").toBeVisible();
      await incompleteFeedbackOption(page).check();
      await expect(feedbackSubmitButton(page), "Submit should be enabled when feedback is provided").toBeEnabled();

      await incompleteFeedbackOption(page).uncheck();
      await feedbackReason(page, "Other").check();
      await expect(feedbackSubmitButton(page), "Submit should stay disabled when Other is selected without details").toBeDisabled();
      await feedbackDetailsInput(page).fill("The AI answer did not explain the source well enough.");
      await expect(
        feedbackSubmitButton(page),
        "Submit should be enabled when Other is selected and details are provided",
      ).toBeEnabled();
    });

    await it.step(`7. The following scenarios should lead to the submit button being disabled`, async () => {
      await page.keyboard.press("Escape");
      await expect(feedbackTitle(page), "Feedback dialog should close before checking a clean empty state").toBeHidden();

      await notUsefulButton(page).click();
      await expect(feedbackTitle(page), "Feedback dialog should reopen").toBeVisible();
      await expect(feedbackSubmitButton(page), "Submit should be disabled without feedback").toBeDisabled();

      await feedbackReason(page, "Other").check();
      await feedbackDetailsInput(page).clear();
      await expect(feedbackSubmitButton(page), "Submit should stay disabled when Other has empty details").toBeDisabled();
    });

    await it.step(`8. Select Incomplete and press on "Submit"`, async () => {
      await feedbackReason(page, "Other").uncheck();
      await incompleteFeedbackOption(page).check();
      await feedbackSubmitButton(page).click();
      await expect(feedbackTitle(page), "Feedback dialog should close after submitting feedback").toBeHidden();
      await expectDislikedFeedbackState(page);
    });
  });
});
