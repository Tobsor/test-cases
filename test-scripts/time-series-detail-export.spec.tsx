import { expect, test, type Page } from "@playwright/test";

async function gotoPolicyRate(page: Page): Promise<void> {
  await page.goto("/topics/CBPOL/BIS,WS_CBPOL,1.0/D.BR");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Central bank policy rates, Brazil" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Time series Detail Export", () => {
  test("opens and configures the export dialog for a detail page", async ({ page }) => {
    await gotoPolicyRate(page);

    await main(page).getByRole("button", { name: "1Y" }).click();
    await main(page).getByRole("radio", { name: "Observations" }).click();
    await expect(page).toHaveURL(/view=observations/);

    await main(page).getByRole("button", { name: "Export" }).click();

    const dialog = page.locator('[role="dialog"][data-state="open"]').filter({ hasText: "Export" });
    await expect(dialog).toBeAttached();
    await expect(dialog).toContainText("Export");
    await expect(dialog.getByRole("tab", { name: "Time series" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByText("Export data of 1 time series")).toBeVisible();
    await expect(dialog.getByRole("form", { name: "Export time series form" })).toBeVisible();
    await expect(dialog.getByRole("radiogroup", { name: "File Format" })).toBeVisible();
    await expect(dialog.getByRole("radiogroup", { name: "Format", exact: true })).toBeVisible();
    await expect(dialog.getByRole("radiogroup", { name: "Additional time series information" })).toBeVisible();
    await expect(dialog.getByText("Citation", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByRole("link", { name: "the terms and conditions for use" })).toHaveAttribute(
      "href",
      "/help/legal",
    );

    await dialog.getByRole("tab", { name: "Code snippet" }).click({ force: true });
    await expect(dialog.getByRole("tab", { name: "Code snippet" })).toHaveAttribute("aria-selected", "true");

    await dialog.getByRole("tab", { name: "Time series" }).click({ force: true });
    await expect(dialog.getByRole("button", { name: "Export" })).toBeAttached();

    await dialog.getByRole("button", { name: "Close modal" }).click({ force: true });
    await expect(dialog).toBeHidden();
  });
});
