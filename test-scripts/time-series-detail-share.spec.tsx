import { expect, test, type Page } from "@playwright/test";

async function gotoPolicyRate(page: Page): Promise<void> {
  await page.goto("/topics/CBPOL/BIS,WS_CBPOL,1.0/D.BR");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Central bank policy rates, Brazil" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Time Series Detail Share", () => {
  test("shares the current time-series detail view URL", async ({ page }) => {
    await gotoPolicyRate(page);

    await main(page).getByRole("button", { name: "5Y" }).click();
    await main(page).getByRole("radio", { name: "Observations" }).click();
    await expect(page).toHaveURL(/view=observations/);
    await expect(main(page).getByRole("region", { name: "Observations" })).toBeVisible();

    await main(page).getByRole("button", { name: "Share" }).click();

    const dialog = page.locator('[role="dialog"][data-state="open"]').filter({ hasText: "Share" });
    await expect(dialog).toBeAttached();
    await expect(dialog).toContainText("Share");
    await expect(dialog).toContainText("Use this URL to share this view");

    const urlInput = dialog.getByRole("textbox", { name: "URL" });
    await expect(urlInput).toHaveValue(/\/topics\/CBPOL\/BIS%2CWS_CBPOL%2C1\.0\/D\.BR\?/);
    await expect(urlInput).toHaveValue(/view=observations/);
    await expect(urlInput).toHaveValue(/filter=TIMESPAN/);
    await expect(dialog.getByRole("button", { name: "Copy to clipboard" })).toBeAttached();

    const sharedUrl = await urlInput.inputValue();
    const sharedPage = await page.context().newPage();
    await sharedPage.goto(sharedUrl);
    await expect(sharedPage).toHaveURL(/view=observations/);
    await expect(sharedPage.getByRole("heading", { level: 1, name: "Central bank policy rates, Brazil" })).toBeVisible();
    await expect(sharedPage.locator("main").getByRole("radio", { name: "Observations" })).toBeChecked();
    await sharedPage.close();

    await dialog.getByRole("button", { name: "Close modal" }).click({ force: true });
    await expect(dialog).toBeHidden();
  });
});
