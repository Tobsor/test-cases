import { expect, test } from "@playwright/test";

const SECTIONS = [
  "About", "Metadata", "Commentary", "Methodology",
  "Research and publications", "Glossary", "FAQs", "Related topics",
];

test.describe("Topic Overview Page", () => {
  test("renders the documented LBS overview and navigation", async ({ page }) => {
    const main = page.getByRole("main");
    const section = (name: string) => main.getByRole("region", { name, exact: true });
    const toc = main.getByRole("navigation", { name: "Table of contents", exact: true });

    await test.step("1. Navigate to /topics/LBS and verify the heading and background image", async () => {
      await page.goto("/topics/LBS");
      const title = main.getByRole("heading", { level: 1, name: "Locational banking statistics", exact: true });
      await expect(title).toBeVisible();
      await expect(page).toHaveTitle("Locational banking statistics - overview | BIS Data Portal");
      // The decorative banner image is aria-hidden, so inspect it from the accessible title.
      await expect.poll(() => title.evaluate((element) => {
        const image = element.closest("section")?.querySelector("picture img") as HTMLImageElement | null;
        return !!image && image.complete && image.naturalWidth > 0
          && image.getBoundingClientRect().height > 0
          && getComputedStyle(image).visibility === "visible";
      }), { message: "The topic banner background image should load" }).toBe(true);
    });

    await test.step("2. Verify local navigation and selected Overview", async () => {
      const navigation = main.getByRole("navigation", { name: "Page navigation", exact: true });
      await expect(navigation.getByRole("link")).toHaveText(["Overview", "Tables & dashboards", "Data"]);
      await expect(navigation.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
      for (const [name, href] of [
        ["Overview", "/topics/LBS"],
        ["Tables & dashboards", "/topics/LBS/tables-and-dashboards"],
        ["Data", "/topics/LBS/data"],
      ]) {
        const link = navigation.getByRole("link", { name, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", href);
      }
    });

    await test.step("3. Verify About", async () => {
      await expect(section("About").getByRole("heading", { name: "About", exact: true })).toBeVisible();
      await expect(section("About").getByRole("paragraph").first()).toHaveText(/measure international banking activity from a residence perspective/i);
    });

    await test.step("4. Verify Metadata, release-calendar filtering, and Contact navigation", async () => {
      const metadata = section("Metadata");
      await expect(metadata.getByRole("term")).toHaveText([
        "Supervising committee", "Seasonal adjustment", "Frequencies", "Contact", "Units",
        "Next release date", "Last release date",
      ]);
      const definitions = metadata.getByRole("definition");
      await expect(definitions).toHaveCount(7);
      for (const definition of await definitions.all()) await expect(definition).not.toBeEmpty();
      await expect(metadata.getByRole("time")).toHaveCount(2);
      for (const date of await metadata.getByRole("time").all()) {
        await expect(date).toHaveText(/^\d{1,2} [A-Za-z]+ \d{4}$/);
      }
      await metadata.getByRole("link", { name: "View all", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/release-calendar" && url.searchParams.get("filter") === "categoryId=LBS");
      await expect(main.getByRole("button", { name: /^Topics filter collapsed/ })).toHaveText("Topics: Locational banking statistics [LBS]");
      await page.goBack();
      await metadata.getByRole("link", { name: "BIS statistics", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/help/contact" && url.searchParams.get("topic") === "LBS");
      await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
      await page.goBack();
      await expect(metadata).toBeVisible();
    });

    await test.step("5. Verify Commentary and its latest and overview links", async () => {
      const commentary = section("Commentary");
      await expect(commentary.getByRole("article")).not.toBeEmpty();
      await expect(commentary.getByRole("link", { name: "View latest", exact: true })).toHaveAttribute("href", "https://www.bis.org/stats_banking_commentaries/latest.htm");
      await expect(commentary.getByRole("link", { name: "View all", exact: true })).toHaveAttribute("href", "https://www.bis.org/stats_banking_commentaries/index.htm");
    });

    await test.step("6. Verify Methodology tabs and article content", async () => {
      const methodology = section("Methodology");
      await expect(methodology.getByRole("tab")).toHaveText(["Explanatory Notes", "Reporting guidelines"]);
      await expect(methodology.getByRole("tab", { name: "Explanatory Notes", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(methodology.getByRole("tab", { name: "Reporting guidelines", exact: true })).toHaveAttribute("aria-selected", "false");
      const panel = methodology.getByRole("tabpanel", { name: "Explanatory Notes", exact: true });
      const articles = panel.getByRole("article");
      await expect(articles.first()).toBeVisible();
      for (const article of await articles.all()) {
        const title = article.getByRole("heading", { level: 3 });
        await expect(title).toBeVisible();
        await expect(title).not.toBeEmpty();
        await expect(article.getByRole("link", { name: await title.innerText(), exact: true })).toHaveAttribute("href", /\S+/);
        // Description and optional subtitle have no semantic roles; exclude title/date text.
        const content = await article.innerText();
        const dates = await article.getByRole("time").allTextContents();
        let description = content.replace(await title.innerText(), "");
        for (const date of dates) description = description.replace(date, "");
        expect(description.trim().length).toBeGreaterThan(0);
      }
      for (const date of await panel.getByRole("time").all()) await expect(date).toHaveText(/^\d{1,2} [A-Za-z]+ \d{4}$/);
      const reportingCountries = articles.filter({ has: page.getByRole("heading", { name: "IBS reporting countries", exact: true }) });
      await expect(reportingCountries.getByText("Bank for International Settlements", { exact: true })).toBeVisible();
      await expect(reportingCountries.getByText("Countries reporting the international banking statistics with the first quarter when data are available", { exact: true })).toBeVisible();
    });

    await test.step("7. Verify Research and publications accordions", async () => {
      const research = section("Research and publications");
      const accordions = research.getByRole("heading", { level: 3 }).getByRole("button");
      await expect(accordions.first()).toBeVisible();
      for (const accordion of await accordions.all()) await expect(accordion).toHaveAttribute("aria-expanded", "false");
      const first = accordions.first();
      await first.click();
      await expect(first).toHaveAttribute("aria-expanded", "true");
      await expect(research.getByRole("link").first()).toBeVisible();
      await first.click();
      await expect(first).toHaveAttribute("aria-expanded", "false");
    });

    await test.step("8. Verify Glossary and its full-glossary link", async () => {
      await expect(section("Glossary").getByRole("heading", { name: "Glossary", exact: true })).toBeVisible();
      await expect(section("Glossary").getByRole("link", { name: "View full", exact: true })).toHaveAttribute("href", "/help/glossary");
    });

    await test.step("9. Verify FAQs", async () => {
      await expect(section("FAQs").getByRole("heading", { name: "FAQs", exact: true })).toBeVisible();
      await expect(section("FAQs").getByRole("heading", { level: 3 }).getByRole("button").first()).toBeVisible();
    });

    await test.step("10. Verify the single related topic and section order", async () => {
      await expect(main.getByRole("heading", { level: 2 })).toHaveText(SECTIONS);
      const related = section("Related topics");
      await expect(related.getByRole("link")).toHaveCount(1);
      const card = related.getByRole("link", { name: /Consolidated banking statistics/ });
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("href", "/topics/CBS");
      await expect(related.getByRole("link", { name: /Locational banking statistics/ })).toHaveCount(0);
      await card.click();
      await expect(page).toHaveURL((url) => url.pathname === "/topics/CBS");
      await expect(main.getByRole("heading", { name: "Consolidated banking statistics", level: 1, exact: true })).toBeVisible();
      await page.goBack();
    });

    await test.step("11. Verify right-hand anchors and highlighting of the visible section", async () => {
      await expect(toc.getByRole("link")).toHaveText(SECTIONS);
      for (const name of ["About", "Methodology"]) {
        const link = toc.getByRole("link", { name, exact: true });
        await link.click();
        await expect(section(name).getByRole("heading", { name, level: 2, exact: true })).toBeInViewport({ ratio: 1 });
        await expect(link).toHaveAttribute("aria-current", "true");
        await expect.poll(() => toc.getByRole("link").evaluateAll((links) =>
          links.filter((item) => item.getAttribute("aria-current") === "true").length,
        )).toBe(1);
      }
      const navBox = await toc.boundingBox();
      const contentBox = await section("Methodology").boundingBox();
      expect(navBox).not.toBeNull();
      expect(contentBox).not.toBeNull();
      expect(navBox!.x).toBeGreaterThanOrEqual(contentBox!.x + contentBox!.width);
    });

    await test.step("12. Verify alternating white and grey section backgrounds", async () => {
      const colors = [];
      for (const name of SECTIONS) {
        colors.push(await section(name).evaluate((element) => {
          for (let current: Element | null = element; current; current = current.parentElement) {
            const color = getComputedStyle(current).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
          }
          return "rgb(255, 255, 255)";
        }));
      }
      expect(colors).toEqual(SECTIONS.map((_, index) => index % 2 === 0 ? "rgb(255, 255, 255)" : "rgb(247, 247, 247)"));
    });
  });
});
