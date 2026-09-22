import { expect, test } from "@playwright/test";

type ReleaseGroup = { date: string; count: number; highlighted: boolean };

test.describe("Release calendar Page Structure (Desktop)", () => {
  test("follows the numbered desktop page structure workflow", async ({ page }) => {
    const main = page.getByRole("main");
    const viewSwitch = main.getByRole("radiogroup", { name: "view switch" });
    let today: string;
    let displayedMonths: string[];
    const groups: ReleaseGroup[] = [];

    await test.step("1. Navigate to /release-calendar and verify the desktop page structure", async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/release-calendar");
      await expect(main.getByRole("heading", { level: 1, name: "Release calendar of BIS statistics", exact: true })).toBeVisible();
      await expect(page).toHaveTitle(/Release calendar of BIS statistics \| BIS Data Portal/);
      await expect(main.getByText("Find the latest publication dates of BIS statistics on this page.")).toBeVisible();

      const releaseDate = main.getByRole("button", { name: /^Release date filter collapsed/ });
      const topics = main.getByRole("button", { name: /^Topics filter collapsed/ });
      const rss = main.getByRole("link", { name: /RSS calendar feed/i });
      const exportButton = main.getByRole("button", { name: /^Export menu collapsed/ });
      for (const control of [releaseDate, topics, rss, exportButton, viewSwitch]) {
        await expect(control).toBeVisible();
      }
      await expect(rss).toHaveAttribute("href", "/feed.xml");
      await expect(viewSwitch.getByRole("radio", { name: "Calendar", exact: true })).toBeChecked();
      await expect(viewSwitch.getByRole("radio", { name: "List", exact: true })).toBeVisible();

      today = await page.evaluate(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      });
      const grid = main.getByRole("grid");
      await expect(grid).toBeVisible();
      const headers = grid.getByRole("columnheader");
      await expect.poll(() => headers.count()).toBeGreaterThan(1);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      displayedMonths = [];
      for (const header of await headers.all()) {
        const label = await header.getByRole("heading", { level: 2 }).innerText();
        const match = label.match(/([A-Za-z]+)\s*(\d{4})/);
        expect(match, `Valid month header: ${label}`).not.toBeNull();
        const month = monthNames.indexOf(match![1]);
        expect(month).toBeGreaterThanOrEqual(0);
        displayedMonths.push(`${match![2]}-${String(month + 1).padStart(2, "0")}`);
      }
      const currentMonth = today.slice(0, 7);
      const previousMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1);
      const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
      expect([currentMonth, previousMonthKey]).toContain(displayedMonths[0]);
      for (let index = 1; index < displayedMonths.length; index++) {
        const previous = new Date(`${displayedMonths[index - 1]}-01T00:00:00Z`);
        previous.setUTCMonth(previous.getUTCMonth() + 1);
        expect(displayedMonths[index]).toBe(previous.toISOString().slice(0, 7));
      }
      await expect(headers.first().getByRole("button", { name: "Show previous months", exact: true })).toBeVisible();
      await expect(headers.last().getByRole("button", { name: "Show next months", exact: true })).toBeVisible();

      const columns = grid.getByRole("gridcell");
      await expect(columns).toHaveCount(displayedMonths.length);
      for (let columnIndex = 0; columnIndex < displayedMonths.length; columnIndex++) {
        // Date-group wrappers have aria-details but no accessible role.
        const dateGroups = columns.nth(columnIndex).locator('[aria-details="Scheduled release"], [aria-details="Upcoming release"]');
        for (const group of await dateGroups.all()) {
          const heading = group.getByRole("heading", { level: 3 });
          const dateLabel = await heading.innerText();
          const day = dateLabel.match(/^\d{1,2}/)?.[0];
          expect(day, `Valid release date: ${dateLabel}`).toBeTruthy();
          const date = `${displayedMonths[columnIndex]}-${day!.padStart(2, "0")}`;
          await expect(heading).toHaveCSS("background-color", date < today ? "rgb(229, 229, 229)" : "rgba(185, 89, 86, 0.2)");
          const entries = group.getByRole("listitem");
          expect(await entries.count()).toBeGreaterThan(0);
          let count = 0;
          for (const entry of await entries.all()) {
            await expect(entry.getByRole("link")).toHaveText(/\S/);
            const descriptions = entry.getByRole("paragraph");
            expect(await descriptions.count()).toBeGreaterThan(0);
            for (const description of await descriptions.all()) {
              // A topic can contain multiple releases with different periods/types.
              await expect(description).toHaveText(/^\d{4}(?:-(?:Q[1-4]|S[12]|\d{2})(?:-\d{2})?)?\s*\/\s*\S.+$/);
              count++;
            }
          }
          const highlighted = await group.getAttribute("aria-details") === "Upcoming release";
          if (highlighted) {
            await expect(group).toHaveCSS("border-left-color", "rgb(170, 51, 47)");
            await expect(group).toHaveCSS("border-left-style", "solid");
            await expect(group).toHaveCSS("border-left-width", "4px");
          }
          groups.push({ date, count, highlighted });
        }
      }

      const upcoming = groups.filter((group) => group.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      expect(upcoming.length).toBeGreaterThan(0);
      expect(groups.filter((group) => group.highlighted).map((group) => group.date)).toEqual([upcoming[0].date]);
      const pastThisMonth = groups.filter((group) => group.date < today && group.date.startsWith(currentMonth));
      const pastCount = pastThisMonth.reduce((sum, group) => sum + group.count, 0);
      if (Number(today.slice(8)) <= 7) expect(pastCount).toBe(0);
      else expect(pastCount).toBeGreaterThan(0);

      const pastDates = groups.filter((group) => group.date < today)
        .flatMap((group) => Array<string>(group.count).fill(group.date)).sort().reverse();
      expect(pastDates.length).toBeGreaterThanOrEqual(7);
      expect(pastDates.slice(6).every((date) => date === pastDates[6])).toBe(true);
      if (pastCount > 7) await expect(columns.nth(displayedMonths.indexOf(currentMonth)).getByRole("button", { name: "Show past releases", exact: true })).toBeVisible();
    });

    await test.step("2. Press List in the Calendar/List view toggle", async () => {
      await viewSwitch.getByRole("radio", { name: "List", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/release-calendar" && url.searchParams.get("view") === "list");
      await expect(viewSwitch.getByRole("radio", { name: "List", exact: true })).toBeChecked();
      for (const name of ["Latest", "Upcoming", "Past"]) {
        await expect(main.getByRole("tab", { name: new RegExp(`^${name} releases \\(\\d+\\)$`) })).toBeVisible();
      }
      const latest = main.getByRole("tabpanel", { name: /^Latest releases \(\d+\)$/ });
      const listGrid = latest.getByRole("grid");
      for (const name of ["Release Date", "Topic", "Reference Period", "Release Type"]) {
        await expect(listGrid.getByRole("columnheader", { name, exact: true })).toBeVisible();
      }
      const summary = latest.getByText(/^Showing \d+ of \d+$/);
      await expect(summary).toBeVisible();
      const total = Number((await summary.innerText()).match(/^Showing \d+ of (\d+)$/)![1]);
      const dates = listGrid.getByRole("gridcell").getByRole("gridcell");
      await expect(dates).toHaveCount(total);
      const latestDates = await dates.allTextContents();
      // Cross-check the calendar against all Latest releases, including same-day ties.
      const expected = latestDates.filter((date) => date < today && displayedMonths.includes(date.slice(0, 7))).sort();
      const calendarDates = groups.filter((group) => group.date < today)
        .flatMap((group) => Array<string>(group.count).fill(group.date)).sort();
      expect(calendarDates).toEqual(expected);
    });
  });
});
