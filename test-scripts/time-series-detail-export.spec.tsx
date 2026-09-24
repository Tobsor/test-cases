import { expect, test, type Locator, type Page } from "@playwright/test";

const BRAZIL_PATH = "/topics/CBPOL/BIS,WS_CBPOL,1.0/D.BR";
const NORTH_MACEDONIA_PATH = "/topics/CBPOL/BIS,WS_CBPOL,1.0/D.MK";

function chart(page: Page): Locator {
  return page.getByRole("region", { name: "Chart", exact: true });
}

function seriesList(page: Page): Locator {
  return page.getByRole("region", { name: "Time series list", exact: true });
}

function exportDialog(page: Page): Locator {
  return page.getByRole("dialog").filter({
    has: page.getByRole("button", { name: "Close modal", exact: true }),
  });
}

async function expectChartSeries(page: Page, expectedNames: string[]): Promise<void> {
  // Plotly traces do not have accessible roles, so inspect their public names.
  await expect.poll(() => chart(page).locator(".js-plotly-plot").evaluate((plot) =>
    ((plot as HTMLElement & { data?: Array<{ name?: string }> }).data ?? [])
      .map(({ name }) => name ?? ""),
  )).toEqual(expectedNames);
}

test.describe("Time series Detail Export", () => {
  test("handles the observation limit and exports a reduced selection", async ({ page }) => {
    const dialog = exportDialog(page);

    await test.step("1. Navigate to the Brazil policy-rate time series", async () => {
      await page.goto(BRAZIL_PATH);
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Central bank policy rates, Brazil",
      })).toBeVisible();
    });

    await test.step("2. Add North Macedonia using the Reference area filter", async () => {
      await page.getByRole("button", { name: /^Reference area filter collapsed/ }).click();
      await page.getByRole("option", { name: "North Macedonia[MK]", exact: true }).click();

      await expect(seriesList(page).getByLabel(/^Toggle visibility of .+ in chart$/)).toHaveCount(2);
      await expect(seriesList(page).getByText("D.BR", { exact: true })).toBeVisible();
      await expect(seriesList(page).getByText("Brazil", { exact: true })).toBeVisible();
      await expect(seriesList(page).getByRole("link", { name: "D.MK", exact: true })).toBeVisible();
      await expect(seriesList(page).getByText("North Macedonia", { exact: true })).toBeVisible();
      await expectChartSeries(page, ["Brazil", "North Macedonia"]);
    });

    await test.step("3. Open Export and verify all export options", async () => {
      await page.getByRole("button", { name: "Export", exact: true }).first().click();
      await expect(dialog.getByRole("banner")).toContainText("Export");
      await expect(dialog.getByRole("tab", { name: "Time series", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(dialog.getByRole("tab", { name: "Code snippet", exact: true })).toBeVisible();
      for (const option of [
        "Excel",
        "CSV",
        "Long (stacked)",
        "Wide (unstacked)",
        "Dimension codes & descriptive labels",
        "Dimension codes",
        "Descriptive labels",
      ]) {
        await expect(dialog.getByText(option, { exact: true })).toBeVisible();
      }
      await expect(dialog.getByText("Citation", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /clipboard/i })).toBeVisible();
    });

    await test.step("4. Attempt the full export and verify the observation-limit error", async () => {
      await dialog.getByRole("button", { name: "Export", exact: true }).click();
      await expect(page.getByText("Download failed", { exact: true })).toBeVisible();
      await expect(page.getByText(/exceeds the limit of 15000 observations/i)).toBeVisible();
      const closeNotification = page.getByRole("button", { name: "Close", exact: true });
      if (await closeNotification.isVisible()) {
        await closeNotification.click();
      }
    });

    await test.step("5. Close the export modal", async () => {
      await dialog.getByRole("button", { name: "Close modal", exact: true }).click();
      await expect(dialog).not.toBeAttached();
      const closeNotification = page.getByRole("button", { name: "Close", exact: true });
      if (await closeNotification.isVisible()) {
        await closeNotification.click();
      }
    });

    await test.step("6. Open D.MK using its text link and make North Macedonia primary", async () => {
      const northMacedoniaLink = seriesList(page).getByRole("link", { name: "D.MK", exact: true });
      await page.mouse.move(10, 900);
      await page.keyboard.press("Escape");
      await northMacedoniaLink.click();
      await expect(page).toHaveURL((url) =>
        url.pathname === NORTH_MACEDONIA_PATH && url.searchParams.get("additional_ts")?.endsWith("^D.BR") === true,
      );
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Central bank policy rates, North Macedonia",
      })).toBeVisible();
    });

    await test.step("7. Remove Brazil and leave only North Macedonia", async () => {
      await seriesList(page).getByRole("button", { name: "Remove row", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === NORTH_MACEDONIA_PATH && url.search === "");
      await expect(seriesList(page).getByLabel(/^Toggle visibility of .+ in chart$/)).toHaveCount(1);
      await expect(seriesList(page)).toContainText("D.MK");
      await expect(seriesList(page)).not.toContainText("D.BR");
      await expectChartSeries(page, ["D.MK"]);
    });

    await test.step("8. Select the 1Y timespan", async () => {
      await page.getByRole("button", { name: "1Y", exact: true }).click();
      await expect(page.getByRole("button", { name: "1Y", exact: true })).toHaveClass(/button--primary/);
    });

    await test.step("9. Reopen Export and download the reduced data", async () => {
      await page.getByRole("button", { name: "Export", exact: true }).first().click();
      await expect(dialog.getByText("Export data of 1 time series")).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Export", exact: true }).click();
      const download = await downloadPromise;

      expect(await download.failure(), "The reduced export download should succeed").toBeNull();
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    });
  });
});
