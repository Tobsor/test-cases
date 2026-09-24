import { expect, test, type Locator, type Page } from "@playwright/test";

const DETAIL_PATH = "/topics/CBPOL/BIS,WS_CBPOL,1.0/D.BR";

function shareDialog(page: Page): Locator {
  return page.getByRole("dialog").filter({
    has: page.getByRole("button", { name: "Close modal", exact: true }),
  });
}

function timespanFromUrl(url: URL): [Date, Date] {
  const timespan = url.searchParams.get("filter")?.match(/^TIMESPAN=([^_]+)_([^_]+)$/);
  expect(timespan, "The shared state should contain a TIMESPAN filter").not.toBeNull();
  return [new Date(timespan![1]), new Date(timespan![2])];
}

async function expectFiveYearTimespan(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "5Y", exact: true })).toHaveClass(/button--primary/);
  const [start, end] = timespanFromUrl(new URL(page.url()));
  const elapsedDays = (end.getTime() - start.getTime()) / 86_400_000;
  expect(elapsedDays).toBeGreaterThanOrEqual(1_825);
  expect(elapsedDays).toBeLessThanOrEqual(1_827);
}

test.describe("Time Series Detail Share", () => {
  test("shares and restores the configured detail-page state", async ({ page, context }) => {
    let copiedUrl = "";

    await test.step("1. Navigate to the Brazil daily policy-rate series", async () => {
      await page.goto(DETAIL_PATH);
      await expect(page).toHaveURL((url) => url.pathname === DETAIL_PATH);
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Central bank policy rates, Brazil",
      })).toBeVisible();
    });

    await test.step("2. Enable the 5Y timespan filter", async () => {
      await page.getByRole("button", { name: "5Y", exact: true }).click();
      await expectFiveYearTimespan(page);
    });

    await test.step("3. Select the Observations view", async () => {
      await page.getByRole("radio", { name: "Observations", exact: true }).click();
      await expect(page.getByRole("radio", { name: "Observations", exact: true })).toBeChecked();
      await expect(page.getByRole("region", { name: "Observations", exact: true })).toBeVisible();
      await expect(page).toHaveURL((url) => url.searchParams.get("view") === "observations");
    });

    await test.step("4. Add Monthly through the Frequency dimension", async () => {
      await page.getByRole("button", { name: /^Frequency filter collapsed/ }).click();
      await page.getByText("Monthly", { exact: true }).click();
      await page.keyboard.press("Escape");

      await expect(page).toHaveURL((url) =>
        url.searchParams.get("additional_ts")?.endsWith("^M.BR") === true,
      );
      const observations = page.getByRole("region", { name: "Observations", exact: true });
      await expect(observations.getByText("D.BR", { exact: true })).toBeVisible();
      await expect(observations.getByText("M.BR", { exact: true })).toBeVisible();
    });

    await test.step("5. Open Share and verify the shareable URL", async () => {
      await page.getByRole("button", { name: "Share", exact: true }).click();
      const dialog = shareDialog(page);
      await expect(dialog.getByRole("banner")).toContainText("Share");
      await expect(dialog.getByText("Use this URL to share this view", { exact: true })).toBeVisible();

      const urlInput = dialog.getByRole("textbox", { name: "URL", exact: true });
      await expect(urlInput).toHaveAttribute("readonly", "");
      await expect(urlInput).not.toHaveValue("");
      const url = new URL(await urlInput.inputValue());
      expect(decodeURIComponent(url.pathname)).toBe(DETAIL_PATH);
      expect(url.searchParams.get("view")).toBe("observations");
      expect(url.searchParams.get("additional_ts")?.endsWith("^M.BR")).toBe(true);
      expect(url.searchParams.get("filter")?.startsWith("TIMESPAN=")).toBe(true);
    });

    await test.step("6. Copy the share URL using the copy icon", async () => {
      const origin = new URL(page.url()).origin;
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
      const dialog = shareDialog(page);
      const expectedUrl = await dialog.getByRole("textbox", { name: "URL", exact: true }).inputValue();
      await dialog.getByRole("button", { name: "Copy to clipboard", exact: true }).click();

      copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedUrl).toBe(expectedUrl);
    });

    await test.step("7. Open the copied URL in a new tab and verify the restored state", async () => {
      const sharedPage = await context.newPage();
      // page.goto represents pasting the copied URL into the browser address field and pressing Enter.
      await sharedPage.goto(copiedUrl);

      await expect(sharedPage).toHaveURL((url) => decodeURIComponent(url.pathname) === DETAIL_PATH);
      await expect(sharedPage.getByRole("heading", {
        level: 1,
        name: "Central bank policy rates, Brazil",
      })).toBeVisible();
      await expectFiveYearTimespan(sharedPage);
      await expect(sharedPage.getByRole("radio", { name: "Observations", exact: true })).toBeChecked();
      await expect(sharedPage.getByRole("region", { name: "Observations", exact: true })).toBeVisible();

      await sharedPage.getByRole("button", { name: /^Frequency filter collapsed/ }).click();
      for (const frequency of ["Daily", "Monthly"]) {
        await expect.poll(() => sharedPage.getByText(frequency, { exact: true }).evaluateAll((labels) =>
          labels.some((label) => {
            const input = label.closest("label")?.control as HTMLInputElement | null;
            return input?.checked === true;
          }),
        )).toBe(true);
      }
      await sharedPage.close();
    });
  });
});
