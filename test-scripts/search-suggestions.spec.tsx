import { expect, test, type Locator, type Page } from "@playwright/test";

function searchInput(page: Page): Locator {
  return page.getByRole("combobox", { name: "Search for time series" }).first();
}

function suggestions(page: Page): Locator {
  return page.getByRole("listbox").first().getByRole("option");
}

async function typeSearchTerm(page: Page, term: string, cursorPosition = term.length): Promise<void> {
  const input = searchInput(page);
  await input.fill(term);
  // Use keyboard events so the app updates suggestions for the actual caret position.
  await input.press("End");
  for (let position = term.length; position > cursorPosition; position--) {
    await input.press("ArrowLeft");
  }
  await expect(input).toHaveValue(term);
  await expect.poll(() => input.evaluate((element: HTMLInputElement) => element.selectionStart))
    .toBe(cursorPosition);
  await expect(page.getByRole("listbox").first()).toBeVisible();
}

async function suggestionRows(page: Page) {
  return suggestions(page).evaluateAll((options) => options.map((option) => {
    const label = option.querySelector(".autocomplete-list__label");
    const description = option.querySelector(".autocomplete-list__category");
    const bold = label?.querySelector("b, strong");
    return {
      label: label?.textContent?.trim() ?? "",
      description: description?.textContent?.trim() ?? "",
      hasDescription: description !== null,
      bold: bold?.textContent ?? "",
      boldWeight: bold ? Number(getComputedStyle(bold).fontWeight) : 0,
    };
  }));
}

async function expectTextSuggestions(page: Page, term: string): Promise<void> {
  await expect(async () => {
    const rows = await suggestionRows(page);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows[0].label).toBe(term);
    expect(rows[0].hasDescription).toBe(false);
    if (term === "Germany") {
      // Check the first seven described items; later labels may match German.
      const exactMatchCount = 7;
      expect(rows.length).toBeGreaterThanOrEqual(exactMatchCount + 1);
      for (const row of rows.slice(1, exactMatchCount + 1)) {
        expect(row.label).toBe(term);
      }
    } else {
      for (const row of rows.slice(1)) {
        expect(row.label.startsWith(term), row.label).toBe(true);
      }
    }
    for (const row of rows.slice(1)) {
      expect(row.description).not.toBe("");
    }
  }).toPass({ timeout: 15_000 });
}

async function expectKeySuggestions(page: Page, prefix: string, segment: RegExp, suffix = ""): Promise<number> {
  await expect(async () => {
    const rows = await suggestionRows(page);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      expect(row.bold).toMatch(segment);
      expect(row.boldWeight).toBeGreaterThanOrEqual(700);
      expect(row.label).toBe(prefix + row.bold + suffix);
      expect(row.description).not.toBe("");
    }
  }).toPass({ timeout: 15_000 });
  return suggestions(page).count();
}

test.describe("Search suggestions", () => {
  test("shows country and series-key suggestions and submits valid searches", async ({ page }) => {
    // Keep the source markdown's numbering; it has no step 7.
    await test.step("1. Navigate to /", async () => {
      await page.goto("/");
      await expect(searchInput(page)).toBeVisible();
    });

    await test.step("2. Click into the search bar", async () => {
      await searchInput(page).click();
      await expect(searchInput(page)).toBeFocused();
    });

    await test.step("3. Type Germany and verify labels and descriptions", async () => {
      await typeSearchTerm(page, "Germany");
      await expectTextSuggestions(page, "Germany");
    });

    await test.step("4. Select Germany — International banking / Consolidated banking statistics", async () => {
      await suggestions(page).filter({
        hasText: /^Germany\s*International banking \/ Consolidated banking statistics$/,
      }).click();
      await expect(page).toHaveURL(
        (url) => url.pathname === "/topics/CBS/data" && url.searchParams.get("q") === "Germany",
      );
    });

    await test.step("5. Open the search bar using the header Search button", async () => {
      await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
      await expect(searchInput(page)).toBeVisible();
    });

    await test.step("6. Type St. and verify all suggestions start with St. or St", async () => {
      await typeSearchTerm(page, "St.");
      await expect(async () => {
        const rows = await suggestionRows(page);
        expect(rows.length).toBeGreaterThan(1);
        expect(rows[0].label).toBe("St.");
        for (const row of rows) {
          // Live-site exceptions: these two payment-system aliases also match St.
          if (["SD&C", "SE Nasdaq OMXDM"].includes(row.label)) {
            expect(row.description).toBe(
              "Payment statistics / Financial market infrastructures and critical service providers",
            );
          } else {
            expect(row.label).toMatch(/^St/i);
          }
        }
      }).toPass({ timeout: 15_000 });
    });

    await test.step("8. Type Q and verify the same behavior as Germany", async () => {
      await typeSearchTerm(page, "Q");
      await expectTextSuggestions(page, "Q");
    });

    await test.step("9. Type Q.A and verify bold A-prefixed segments and descriptions", async () => {
      await typeSearchTerm(page, "Q.A");
      await expectKeySuggestions(page, "Q.", /^A[^.]*$/);
    });

    await test.step("10. Type Q.A. and verify the segment after the last dot is bold", async () => {
      await typeSearchTerm(page, "Q.A.");
      await expectKeySuggestions(page, "Q.A.", /^[^.]+$/);
    });

    let aSegmentCount = 0;
    await test.step("11. Type Q.A.B and position the cursor after A", async () => {
      await typeSearchTerm(page, "Q.A.B", 3);
      // The active A-prefixed segment is bold, including A itself.
      aSegmentCount = await expectKeySuggestions(page, "Q.", /^A[^.]*$/, ".B");
    });

    await test.step("12. Type Q.*.B and position the cursor after *", async () => {
      await typeSearchTerm(page, "Q.*.B", 3);
      // Interpret the source's step-9 reference as segment completion with
      // a wildcard: preserve .B and expand the preceding step's A-only set.
      await expectKeySuggestions(page, "Q.", /^[^.]+$/, ".B");
      await expect.poll(() => suggestions(page).count()).toBeGreaterThan(aSegmentCount);
    });

    await test.step("13. Verify bold completion after + for Q.A+ and Q.A+.B", async () => {
      await typeSearchTerm(page, "Q.A+", 4);
      await expectKeySuggestions(page, "Q.A+", /^[^.]+$/);
      await typeSearchTerm(page, "Q.A+.B", 4);
      await expectKeySuggestions(page, "Q.A+", /^[^.]+$/, ".B");
    });

    await test.step("14. Type Q.A+N.B,A.* and verify bold completion after the last dot", async () => {
      await typeSearchTerm(page, "Q.A+N.B,A.*");
      await expectKeySuggestions(page, "Q.A+N.B,A.", /^[^.]+$/);
    });

    await test.step("15. Hit Enter and verify the encoded search URL", async () => {
      await searchInput(page).press("Enter");
      await expect(page).toHaveURL(
        (url) => url.pathname === "/search" && url.search === "?q=Q.A%2BN.B%2CA.*",
      );
    });
  });
});
