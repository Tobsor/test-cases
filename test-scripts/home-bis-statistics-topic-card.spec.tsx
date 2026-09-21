import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

async function expectCardImageIsDarkened(card: ReturnType<Page["locator"]>): Promise<void> {
  const hoverState = await card.evaluate((element) => {
    const image = element.querySelector("img");
    const darkOverlay = [...element.querySelectorAll<HTMLElement>("*")].find((node) => {
      const style = getComputedStyle(node);
      return style.backgroundColor === "rgb(0, 0, 0)" && Number(style.opacity) > 0;
    });

    return {
      imageFilter: image ? getComputedStyle(image).filter : "",
      overlayOpacity: darkOverlay ? Number(getComputedStyle(darkOverlay).opacity) : 0,
    };
  });

  expect(hoverState.imageFilter).toContain("blur");
  expect(hoverState.overlayOpacity).toBeGreaterThan(0);
}

test.describe(`Home BIS statistics topic card`, () => {
  test(`Home BIS statistics topic card`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Scroll to the BIS statistics section`, async () => {
      await page.getByRole("heading", { name: "BIS statistics" }).scrollIntoViewIfNeeded();
    });

    await it.step(`3. Hover on the Global liquidity card and show its description`, async () => {
      const gliCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Global liquidity" }) });
      await expect(gliCard).toBeVisible();
      await gliCard.hover();
      await expect(gliCard.getByText(/foreign currency credit/i).first()).toBeVisible();
      await expectCardImageIsDarkened(gliCard);
      await expect(gliCard.locator('a[href="/topics/GLI"]')).toBeVisible();
    });

    await it.step(`4. Clicking the Global liquidity card navigates to /topics/GLI`, async () => {
      const gliCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Global liquidity" }) });
      await gliCard.locator('a[href="/topics/GLI"]').click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/GLI$/);
    });
  });
});
