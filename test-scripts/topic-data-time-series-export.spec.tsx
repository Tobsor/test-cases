import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const DATA_PATH = "/topics/CPP/data";
const SEARCH_TERM = "Switzerland OR Germany";

function main(page: Page): Locator {
  return page.getByRole("main");
}

function resultCount(page: Page): Locator {
  return main(page).getByText(/^[\d,.]+ time series found$/).first();
}

function numberFrom(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

async function openExport(page: Page): Promise<Locator> {
  await main(page).getByRole("button", { name: "Open export modal" }).click();
  const dialog = page.getByRole("dialog", { name: "Export", exact: true });
  const timeSeriesTab = dialog.getByRole("tab", { name: "Time series", exact: true });
  await expect(timeSeriesTab).toBeVisible();
  await expect(timeSeriesTab).toHaveAttribute("aria-selected", "true");
  return dialog;
}

async function saveDownload(download: Download, path: string): Promise<Buffer> {
  await download.saveAs(path);
  return readFile(path);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function zipText(buffer: Buffer): string {
  const endSignature = 0x06054b50;
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== endSignature) end -= 1;
  expect(end, "The Excel file should contain a ZIP directory").toBeGreaterThanOrEqual(0);
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const xml: string[] = [];
  for (let entry = 0; entry < entries; entry += 1) {
    expect(buffer.readUInt32LE(offset)).toBe(0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name.endsWith(".xml")) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);
      const contents = method === 8 ? inflateRawSync(compressed) : compressed;
      xml.push(contents.toString("utf8"));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return xml.join("\n");
}

function exportOption(dialog: Locator, name: string): Locator {
  // Each option exposes both a wrapper and a nested input as radios.
  // Select the wrapper explicitly so the locator also contains its info icon.
  return dialog.getByRole("radio", { name, exact: true }).filter({
    has: dialog.page().getByRole("radio", { name, exact: true }),
  });
}

async function hoverInfo(dialog: Locator, label: string): Promise<void> {
  // Info icons are aria-hidden and expose no accessible name or interactive role.
  await exportOption(dialog, label).locator("i").hover();
  const tooltip = dialog.page().getByRole("tooltip");
  if (label === "Dimension codes") {
    await expect.soft(tooltip).toBeVisible({ timeout: 3_000 });
    if (await tooltip.isVisible()) await expect(tooltip).not.toHaveText("");
    return;
  }
  await expect(tooltip).toBeVisible();
  await expect(tooltip).not.toHaveText("");
}

test.describe("Topic Data Time Series Export", () => {
  test("exports filtered and selected topic time series in the documented formats", async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);
    let seriesCount = 0;
    let excelBuffer: Buffer;
    let csvRows: string[][] = [];
    let sourceUrl = "";
    let downloadUrl = "";
    let selectedSeriesKey = "";
    let selectedExcelBuffer: Buffer;

    await test.step("1. Go to /topics/CPP/data", async () => {
      const heading = page.getByRole("heading", { level: 1, name: "Commercial property prices" });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto(DATA_PATH);
        if (await heading.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false)) break;
      }
      await expect(heading).toBeVisible();
    });

    await test.step("2. Search for Switzerland OR Germany and verify results", async () => {
      const input = main(page).getByRole("combobox", { name: "Search for time series" });
      await input.fill(SEARCH_TERM);
      await input.press("Enter");
      await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && url.searchParams.get("q") === SEARCH_TERM);
      await expect(resultCount(page)).toBeVisible();
      expect(numberFrom(await resultCount(page).innerText())).toBeGreaterThan(0);
    });

    await test.step("3. Open the Covered area filter", async () => {
      await main(page).getByRole("button", { name: "Filters", exact: true }).click();
      await main(page).getByRole("button", { name: /^Covered area filter collapsed/ }).click();
      await expect(page.getByRole("option").filter({ hasText: "Whole country" })).toBeVisible();
    });

    await test.step("4. Select Whole country", async () => {
      await page.getByRole("option").filter({ hasText: "Whole country" }).click();
      await page.keyboard.press("Escape");
      await expect(main(page).getByRole("button", { name: /^Covered area filter collapsed/ })).toHaveText(
        /Covered area: Whole country \[0\]/,
      );
    });

    await test.step("5. Open the Timespan filter", async () => {
      await main(page).getByRole("button", { name: /^Timespan filter collapsed/ }).click();
      await expect(page.getByRole("tab", { name: "Range", exact: true })).toBeVisible();
    });

    await test.step("6. Select Last ...", async () => {
      await page.getByRole("tab", { name: "Last ...", exact: true }).click();
    });

    await test.step("7. Select Observations", async () => {
      const observations = page.getByRole("radio", { name: "Observations", exact: true });
      await observations.click();
      await expect(observations).toHaveAttribute("aria-checked", "true");
    });

    await test.step("8. Select 8 observations and close the filter", async () => {
      const dialog = page.getByRole("dialog").last();
      await dialog.getByRole("button", { name: "8", exact: true }).click();
      await expect(page.getByRole("spinbutton", { name: "Amount of observations:" })).toHaveValue("8");
      await page.keyboard.press("Escape");
      await expect(main(page).getByRole("button", { name: /^Timespan filter collapsed/ })).toHaveText(
        /Timespan: Last 8 observation\(s\)/,
      );
    });

    await test.step("9. Record the number of listed time series", async () => {
      await expect(resultCount(page)).toHaveText("4 time series found");
      await expect(main(page).getByRole("article")).toHaveCount(4);
      seriesCount = numberFrom(await resultCount(page).innerText());
    });

    let exportDialog: Locator;
    await test.step("10. Open Export and verify its default time-series configuration", async () => {
      exportDialog = await openExport(page);
      await expect(exportDialog.getByRole("tabpanel", { name: "Time series", exact: true })
        .getByText(`Export data of ${seriesCount} time series including observations and additional information.`, { exact: true })).toBeVisible();
      await expect(exportDialog.getByRole("textbox")).toHaveValue(/BIS WS_CPP 1\.0|Commercial property prices/i);
      await expect(exportDialog.getByRole("link", { name: /terms and conditions/i })).toBeVisible();
      await expect(exportOption(exportDialog, "Excel")).toBeChecked();
      await expect(exportOption(exportDialog, "CSV")).toBeVisible();
      await expect(exportOption(exportDialog, "Long (stacked)")).toBeChecked();
      await expect(exportOption(exportDialog, "Wide (unstacked)")).toBeVisible();
      await expect(exportOption(exportDialog, "Dimension codes & descriptive labels")).toBeChecked();
      await expect(exportOption(exportDialog, "Dimension codes")).toBeVisible();
    });

    await test.step("11. Hover over the Long information icon and verify its tooltip", async () => {
      await hoverInfo(exportDialog, "Long (stacked)");
    });

    await test.step("12. Hover over the Wide information icon and verify its tooltip", async () => {
      await hoverInfo(exportDialog, "Wide (unstacked)");
    });

    await test.step("13. Hover over the Dimension codes information icon and verify its tooltip", async () => {
      await hoverInfo(exportDialog, "Dimension codes");
    });

    await test.step("14. Select Wide and verify its configuration options", async () => {
      await exportOption(exportDialog, "Wide (unstacked)").check();
      await expect(exportDialog.getByRole("checkbox", { name: "Split frequency in worksheets", exact: true })).toBeVisible();
      await expect(exportDialog.getByRole("checkbox", {
        name: "Transposed (one time series per row)",
        exact: true,
      })).toBeVisible();
    });

    await test.step("15. Select Transposed", async () => {
      const transposed = exportDialog.getByRole("checkbox", {
        name: "Transposed (one time series per row)",
        exact: true,
      });
      await transposed.check();
      await expect(transposed).toBeChecked();
    });

    await test.step("16. Export and download the Excel file", async () => {
      const downloadPromise = page.waitForEvent("download");
      await exportDialog.getByRole("button", { name: "Export", exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
      excelBuffer = await saveDownload(download, testInfo.outputPath("all-series.xlsx"));
      await expect(exportDialog.getByRole("heading", { name: "Export", exact: true })).toBeHidden();
    });

    await test.step("17. Open the Excel export and verify series, observations, codes, and labels", async () => {
      expect(excelBuffer.subarray(0, 2).toString()).toBe("PK");
      const workbookText = zipText(excelBuffer);
      const keys = new Set(workbookText.match(/BIS:WS_CPP\(1\.0\):[^<]+/g) ?? []);
      expect(keys.size).toBe(seriesCount);
      expect(workbookText).toContain("REF_AREA");
      expect(workbookText).toMatch(/Reference area/i);
      expect(workbookText).toContain("LAST_N_OBSERVATIONS");
    });

    await test.step("18. Open Export again", async () => {
      exportDialog = await openExport(page);
      await expect(exportDialog.getByRole("tabpanel", { name: "Time series", exact: true })
        .getByText(`Export data of ${seriesCount} time series including observations and additional information.`, { exact: true })).toBeVisible();
    });

    await test.step("19. Select CSV", async () => {
      await exportOption(exportDialog, "CSV").check();
      await expect(exportOption(exportDialog, "CSV")).toBeChecked();
    });

    await test.step("20. Select Dimension codes", async () => {
      await exportOption(exportDialog, "Dimension codes").check();
      await expect(exportOption(exportDialog, "Dimension codes")).toBeChecked();
    });

    await test.step("21. Export and download the CSV file", async () => {
      const downloadPromise = page.waitForEvent("download");
      await exportDialog.getByRole("button", { name: "Export", exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      const csvBuffer = await saveDownload(download, testInfo.outputPath("all-series.csv"));
      csvRows = parseCsv(csvBuffer.toString("utf8"));
      await expect(exportDialog.getByRole("heading", { name: "Export", exact: true })).toBeHidden();
    });

    await test.step("22. Open the CSV and verify every series, observation limit, and code-only dimensions", async () => {
      const headerIndex = csvRows.findIndex((row) => row[0] === "KEY");
      expect(headerIndex).toBeGreaterThanOrEqual(0);
      const headers = csvRows[headerIndex];
      const keyIndex = headers.indexOf("KEY");
      const dataRows = csvRows.slice(headerIndex + 1);
      const observationsByKey = new Map<string, number>();
      for (const row of dataRows) {
        const key = row[keyIndex];
        if (key) observationsByKey.set(key, (observationsByKey.get(key) ?? 0) + 1);
      }
      expect(observationsByKey.size).toBe(seriesCount);
      expect([...observationsByKey.values()].every((count) => count <= 8)).toBe(true);
      expect(headers).toContain("REF_AREA");
      expect(headers).not.toContain("Reference area");
    });

    await test.step("23. Copy the Source URL from the CSV", async () => {
      const headings = csvRows[0];
      const values = csvRows[1];
      sourceUrl = values[headings.indexOf("Source URL")];
      downloadUrl = values[headings.indexOf("Download URL")];
      expect(sourceUrl).toMatch(/^https:\/\/data\.bis\.org\/topics\/CPP\/data\?/);
      expect(downloadUrl).toMatch(/^https:\/\/data\.bis\.org\/api\/export-timeseries\?/);
    });

    let sharedPage!: Page;
    await test.step("24. Open the Source URL in a new tab and verify search and filters", async () => {
      sharedPage = await context.newPage();
      await sharedPage.goto(sourceUrl);
      await expect(main(sharedPage).getByRole("combobox", { name: "Search for time series" })).toHaveValue(SEARCH_TERM);
      await expect(resultCount(sharedPage)).toHaveText(`${seriesCount} time series found`);
      await ensureFiltersVisible(sharedPage);
      await expect(main(sharedPage).getByRole("button", { name: /^Covered area filter collapsed/ })).toHaveText(
        /Covered area: Whole country \[0\]/,
      );
      await expect(main(sharedPage).getByRole("button", { name: /^Timespan filter collapsed/ })).toHaveText(
        /Timespan: Last 8 observation\(s\)/,
      );
    });

    await test.step("25. Select one time series and verify 1 selected", async () => {
      const card = main(sharedPage).getByRole("article").first();
      const lines = (await card.innerText()).split("\n").map((line) => line.trim()).filter(Boolean);
      selectedSeriesKey = lines[lines.indexOf("Series key") + 1];
      await card.getByRole("checkbox", { name: "Select time series" }).check();
      await expect(main(sharedPage).getByText("1 selected", { exact: true })).toBeVisible();
    });

    await test.step("26. Open Export and verify one time series will be exported", async () => {
      exportDialog = await openExport(sharedPage);
      await expect(exportDialog.getByRole("tabpanel", { name: "Time series", exact: true })
        .getByText("Export data of 1 time series including observations and additional information.", { exact: true })).toBeVisible();
    });

    await test.step("27. Select Wide", async () => {
      await exportOption(exportDialog, "Wide (unstacked)").check();
    });

    await test.step("28. Select Descriptive labels", async () => {
      await exportOption(exportDialog, "Descriptive labels").check();
      await expect(exportOption(exportDialog, "Descriptive labels")).toBeChecked();
    });

    await test.step("29. Export and download the selected series as Excel", async () => {
      const downloadPromise = sharedPage.waitForEvent("download");
      await exportDialog.getByRole("button", { name: "Export", exact: true }).click();
      const download = await downloadPromise;
      selectedExcelBuffer = await saveDownload(download, testInfo.outputPath("selected-series.xlsx"));
      await expect(exportDialog.getByRole("heading", { name: "Export", exact: true })).toBeHidden();
    });

    await test.step("30. Open the selected-series Excel file and verify labels and eight-observation limit", async () => {
      const workbookText = zipText(selectedExcelBuffer);
      expect(workbookText).toContain(selectedSeriesKey);
      const keys = new Set(workbookText.match(/BIS:WS_CPP\(1\.0\):[^<]+/g) ?? []);
      expect(keys.size).toBe(1);
      expect(workbookText).toMatch(/Reference area/i);
      expect(workbookText).toContain("LAST_N_OBSERVATIONS");
    });

    let repeatedExcelBuffer: Buffer;
    await test.step("31. Download the Excel file using its Download URL", async () => {
      const selectedWorkbookText = zipText(selectedExcelBuffer);
      const encodedUrl = selectedWorkbookText.match(/https:\/\/data\.bis\.org\/api\/export-timeseries[^<\s]+/)?.[0];
      expect(encodedUrl).toBeTruthy();
      const selectedDownloadUrl = encodedUrl!.replaceAll("&amp;", "&");
      const downloadPromise = sharedPage.waitForEvent("download");
      await sharedPage.evaluate((url) => {
        const link = document.createElement("a");
        link.href = url;
        link.click();
      }, selectedDownloadUrl);
      repeatedExcelBuffer = await saveDownload(await downloadPromise, testInfo.outputPath("selected-series-repeat.xlsx"));
    });

    await test.step("32. Verify the Download URL produces the same selected-series workbook", async () => {
      const repeatedText = zipText(repeatedExcelBuffer);
      expect(repeatedText).toContain(selectedSeriesKey);
      const keys = new Set(repeatedText.match(/BIS:WS_CPP\(1\.0\):[^<]+/g) ?? []);
      expect(keys.size).toBe(1);
      expect(repeatedText).toMatch(/Reference area/i);
      await sharedPage.close();
    });
  });
});

async function ensureFiltersVisible(page: Page): Promise<void> {
  const coveredArea = main(page).getByRole("button", { name: /^Covered area filter collapsed/ });
  if (!(await coveredArea.isVisible())) {
    await main(page).getByRole("button", { name: "Filters", exact: true }).click();
  }
  await expect(coveredArea).toBeVisible();
}
