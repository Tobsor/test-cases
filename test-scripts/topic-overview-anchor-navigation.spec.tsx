import { expect, test, type Page } from "@playwright/test";

async function gotoLbsOverview(page: Page): Promise<void> {
  await page.goto("/topics/LBS");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { name: "Locational banking statistics", level: 1 })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Topic Overview Anchor navigation", () => {
  test("jumps to Methodology from the table of contents and preserves the anchor", async ({ page }) => {
    await gotoLbsOverview(page);

    const toc = main(page).getByRole("navigation", { name: "Table of contents" });
    await expect(toc).toBeVisible();
    await expect(toc.getByRole("link", { name: "About" })).toHaveAttribute("href", /#about$/);
    await expect(toc.getByRole("link", { name: "Methodology" })).toHaveAttribute("href", /#methodology$/);

    await toc.getByRole("link", { name: "Methodology" }).click();
    await expect(page).toHaveURL(/\/topics\/LBS#methodology$/);
    await expect(main(page).getByRole("region", { name: "Methodology" })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Methodology" })).toHaveAttribute("aria-current", "true");
    const box = await main(page).getByRole("heading", { name: "Methodology", level: 2 }).boundingBox();
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeGreaterThanOrEqual(0);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(220);

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/topics\/LBS#methodology$/);
    await expect(main(page).getByRole("heading", { name: "Methodology", level: 2 })).toBeVisible();
  });
});
