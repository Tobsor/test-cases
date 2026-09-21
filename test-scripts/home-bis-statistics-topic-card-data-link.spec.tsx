import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

async function expectDataLinkInBottomRight(card: ReturnType<Page["locator"]>, dataLink: ReturnType<Page["locator"]>): Promise<void> {
  const positions = await card.evaluate((element, linkElement) => {
    const cardBox = element.getBoundingClientRect();
    const linkBox = linkElement.getBoundingClientRect();

    return {
      distanceFromRight: Math.round(cardBox.right - linkBox.right),
      distanceFromBottom: Math.round(cardBox.bottom - linkBox.bottom),
      linkWidth: Math.round(linkBox.width),
      linkHeight: Math.round(linkBox.height),
    };
  }, await dataLink.elementHandle());

  expect(positions.linkWidth).toBeGreaterThan(0);
  expect(positions.linkHeight).toBeGreaterThan(0);
  expect(positions.distanceFromRight).toBeGreaterThanOrEqual(0);
  expect(positions.distanceFromRight).toBeLessThan(80);
  expect(positions.distanceFromBottom).toBeGreaterThanOrEqual(0);
  expect(positions.distanceFromBottom).toBeLessThan(100);
}

test.describe(`Home BIS statistics topic card data link`, () => {
  test(`Home BIS statistics topic card data link`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. The Global liquidity statistics card is visible`, async () => {
      await page.getByRole("heading", { name: "BIS statistics" }).scrollIntoViewIfNeeded();
      const gliCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Global liquidity" }) });
      await expect(gliCard).toBeVisible();
      await expect(gliCard.getByText(/foreign currency credit/i).first()).toBeVisible();
    });

    await it.step(`3. The Global liquidity data icon opens the topic data page`, async () => {
      const gliCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Global liquidity" }) });
      await gliCard.hover();
      const dataLink = gliCard.getByRole("link", { name: "Go to data of Global liquidity" });
      await expect(dataLink).toBeVisible();
      await expect(dataLink).toHaveAccessibleName("Go to data of Global liquidity");
      await expectDataLinkInBottomRight(gliCard, dataLink);
      await expect(dataLink).toHaveAttribute("href", "/topics/GLI/data");
      await dataLink.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/GLI\/data/);
    });
  });
});
