import { expect, test, type Locator } from "@playwright/test";

async function expectHeadingAtTop(heading: Locator): Promise<void> {
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport({ ratio: 1 });
  // Wait for anchor scrolling and check that the title is not covered by the header.
  await expect.poll(() => heading.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const isUnobscured = [0.1, 0.5, 0.9].every((fraction) => {
      const topmost = document.elementFromPoint(
        rect.left + rect.width * fraction, rect.top + rect.height / 2,
      );
      return topmost !== null && element.contains(topmost);
    });
    return rect.top >= 0 && rect.bottom <= window.innerHeight
      && rect.top < 220 && isUnobscured;
  }), { message: "Methodology title should be fully visible near the top of the viewport" }).toBe(true);
}

test.describe("Topic Overview Anchor navigation", () => {
  test("jumps to Methodology and preserves the section after refresh", async ({ page }) => {
    const main = page.getByRole("main");
    const toc = main.getByRole("navigation", { name: "Table of contents", exact: true });
    const methodologyLink = toc.getByRole("link", { name: "Methodology", exact: true });
    const methodology = main.getByRole("region", { name: "Methodology", exact: true });
    const heading = methodology.getByRole("heading", { name: "Methodology", level: 2, exact: true });

    await test.step("1. Navigate to /topics/LBS", async () => {
      await page.goto("/topics/LBS");
      await expect(main.getByRole("heading", {
        name: "Locational banking statistics", level: 1, exact: true,
      })).toBeVisible();
      await expect(toc).toBeVisible();
      await expect(methodologyLink).toBeInViewport({ ratio: 1 });
      const tocBox = await toc.boundingBox();
      const sectionBox = await main.getByRole("region", { name: "About", exact: true }).boundingBox();
      expect(tocBox).not.toBeNull();
      expect(sectionBox).not.toBeNull();
      expect(tocBox!.x).toBeGreaterThanOrEqual(sectionBox!.x + sectionBox!.width);
    });

    await test.step("2. Click Methodology in the right-hand anchor navigation", async () => {
      await expect(methodologyLink).toHaveAttribute("href", "#methodology");
      await methodologyLink.click();
      await expect(page).toHaveURL((url) =>
        url.pathname === "/topics/LBS" && url.hash === "#methodology",
      );
      await expect(methodologyLink).toHaveAttribute("aria-current", "true");
      // Assertions do not scroll: the anchor click alone must bring the title into view.
      await expect(heading).toBeInViewport({ ratio: 1 });
    });

    await test.step("3. Verify the Methodology title is fully visible at the top", async () => {
      await expectHeadingAtTop(heading);
    });

    await test.step("4. Refresh and verify the Methodology section remains visible", async () => {
      // Reload performs the browser refresh represented by F5 in the manual workflow.
      await page.reload();
      await expect(page).toHaveURL((url) =>
        url.pathname === "/topics/LBS" && url.hash === "#methodology",
      );
      await expectHeadingAtTop(heading);
    });
  });
});
