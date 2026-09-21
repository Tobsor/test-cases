import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function openContactForm(page: Page): Promise<void> {
  await page.locator("main").getByRole("button", { name: "Contact us" }).click();
  await expect(page.getByRole("heading", { name: "Contact details" })).toBeVisible();
}

async function chooseComboboxOption(page: Page, combobox: Locator, optionName: string): Promise<void> {
  await combobox.click();
  await combobox.fill(optionName);
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function expectSelectedOption(page: Page, optionName: string): Promise<void> {
  await expect(page.locator(".select__value-label").filter({ hasText: optionName })).toBeVisible();
}

const it = test;

test.describe(`Contact Form Basic use case`, () => {
  test(`Contact Form Basic use case`, async ({ page }) => {
    await it.step(`1. Go to [link](https://dataportal.uat.bisinfo.org/help/contact)`, async () => {
      await gotoPath(page, "https://dataportal.uat.bisinfo.org/help/contact");
      await expect(page.getByRole("heading", { name: "What do you need help with?" })).toBeVisible();

      for (const linkName of [
        "Find the data",
        "Check the frequently asked questions",
        "See the latest and upcoming publication dates",
        "Read the terms of permitted use of BIS statistics",
      ]) {
        await expect(page.locator("main").getByRole("link", { name: linkName })).toBeVisible();
      }
    });

    await it.step(`2. Click on the underlined text "Contact us" below the useful link cards`, async () => {
      await openContactForm(page);
      await expect(page.getByRole("heading", { name: "Inquiry" })).toBeVisible();

      await expect(page.getByLabel("First name")).toBeVisible();
      await expect(page.getByLabel("Last name")).toBeVisible();
      await expect(page.getByLabel("Email")).toHaveAttribute("aria-required", "true");
      await expect(page.getByRole("combobox", { name: "Topic", exact: true })).toBeVisible();
      await expect(page.getByLabel("Subject")).toHaveAttribute("aria-required", "true");
      await expect(page.getByLabel("Your inquiry")).toHaveAttribute("aria-required", "true");
      await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
    });

    await it.step(`3. Click into the first name field`, async () => {
      await page.getByLabel("First name").click();
      await expect(page.getByLabel("First name")).toBeFocused();
      await expect(page.getByLabel("First name")).toHaveAttribute("autocomplete", "dont-autocomplete");
    });

    await it.step(`4. Enter the following Data:`, async () => {
      await page.getByLabel("First name").fill("Max");
      await page.getByLabel("Last name").fill("Mustermann");
      await page.getByLabel("Email").fill("max.mustermann@example.com");
      await expect(page.getByLabel("First name")).toHaveValue("Max");
      await expect(page.getByLabel("Last name")).toHaveValue("Mustermann");
      await expect(page.getByLabel("Email")).toHaveValue("max.mustermann@example.com");
    });

    await it.step(`5. Select the "Central bank statistics" in the topic selection`, async () => {
      await chooseComboboxOption(page, page.getByRole("combobox", { name: "Topic", exact: true }), "Central bank statistics");
      await expectSelectedOption(page, "Central bank statistics");
      await expect(page.getByRole("combobox", { name: "Subtopic" })).toBeVisible();
    });

    await it.step(`6. Select the subtopic "Central bank policy rates"`, async () => {
      await chooseComboboxOption(page, page.getByRole("combobox", { name: "Subtopic" }), "Central bank policy rates");
      await expectSelectedOption(page, "Central bank policy rates");
    });

    await it.step(`7. Change the topic to "Credit"`, async () => {
      await chooseComboboxOption(page, page.getByRole("combobox", { name: "Topic", exact: true }), "Credit");
      await expectSelectedOption(page, "Credit");
      await expect(page.getByRole("combobox", { name: "Subtopic" })).toHaveValue("");
    });

    await it.step(`8. Change the topic to "Consumer prices"`, async () => {
      await chooseComboboxOption(page, page.getByRole("combobox", { name: "Topic", exact: true }), "Consumer prices");
      await expectSelectedOption(page, "Consumer prices");
      await expect(page.getByRole("combobox", { name: "Subtopic" })).toHaveCount(0);
    });

    await it.step(`9. Reselect the topic "Central bank statistics" and the subtopic "Central bank policy rates"`, async () => {
      await chooseComboboxOption(page, page.getByRole("combobox", { name: "Topic", exact: true }), "Central bank statistics");
      await chooseComboboxOption(page, page.getByRole("combobox", { name: "Subtopic" }), "Central bank policy rates");
      await expectSelectedOption(page, "Central bank statistics");
      await expectSelectedOption(page, "Central bank policy rates");
    });

    await it.step(`10. Add the remaining missing data as follows:`, async () => {
      await page.getByLabel("Subject").fill("Regression test subject");
      await page
        .getByLabel("Your inquiry")
        .fill("This is a regression test inquiry.");
      await expect(page.getByLabel("Subject")).toHaveValue("Regression test subject");
      await expect(page.getByLabel("Your inquiry")).toHaveValue("This is a regression test inquiry.");
      await expect(page.getByText(/\d+ \/ 500/)).toBeVisible();
    });

    await it.step(`11. Press the submit button`, async () => {
      const submit = page.getByRole("button", { name: "Submit" });
      await expect(submit).toBeVisible();
      await expect(submit).toBeEnabled();
    });
  });
});
