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

const it = test;

test.describe(`Contact Form Integrations`, () => {
  test(`Contact Form Integrations`, async ({ page }) => {
    await it.step(`1. Go to [link](https://dataportal.uat.bisinfo.org/help/getting-started)`, async () => {
      await gotoPath(page, "https://dataportal.uat.bisinfo.org/help/getting-started");
      const pageNavigationLinks = page.getByRole("navigation", { name: "Page navigation" }).getByRole("link");
      await expect(pageNavigationLinks.last()).toHaveText("Contact");
    });

    await it.step(`3. Click on "Contact"`, async () => {
      await page.getByRole("navigation", { name: "Page navigation" }).getByRole("link", { name: "Contact" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/help\/contact$/);
      await expect(page.getByRole("heading", { name: "What do you need help with?" })).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: "Contact us" })).toBeVisible();
    });

    await it.step(`3. Go to [link](https://dataportal.uat.bisinfo.org/)`, async () => {
      await gotoPath(page, "https://dataportal.uat.bisinfo.org/");
    });

    await it.step(`4. Scroll to the end of the page until you can see the Footer.`, async () => {
      const footer = page.getByRole("contentinfo");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer.getByRole("heading", { name: "Page Footer" })).toBeAttached();
    });

    await it.step(`5. Click on "Contact us"`, async () => {
      await page.getByRole("contentinfo").getByRole("link", { name: "Contact us" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/help\/contact$/);
      await expect(page.getByRole("heading", { name: "What do you need help with?" })).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: "Contact us" })).toBeVisible();
    });

    await it.step(`6. Go to [link](https://dataportal.uat.bisinfo.org/topics/LBS)`, async () => {
      await gotoPath(page, "https://dataportal.uat.bisinfo.org/topics/LBS");
    });

    await it.step(`7. Click on the Contact link within the Metadata section of the topic overview page`, async () => {
      await page
        .locator("dl")
        .filter({ has: page.locator("dt", { hasText: "Contact" }) })
        .getByRole("link", { name: "BIS statistics" })
        .click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/help\/contact\?topic=LBS$/);
      await page.locator("main").getByRole("button", { name: "Contact us" }).click();
      await expect(page.locator(".select__value-label").filter({ hasText: "International banking" })).toBeVisible();
      await expect(page.locator(".select__value-label").filter({ hasText: "Locational banking statistics" })).toBeVisible();
    });
  });
});
