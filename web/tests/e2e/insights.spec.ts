// Insights (M5a, design spec 10): the page for a fresh user (empty states), the made-up Insights
// user's history (charts and tables agree, hidden kinds are left out, a tick elsewhere shows after a
// reload), the navigation entries and Home's link, and no sideways scrolling. All data is made up
// (scripts/lib/e2e-data.mjs).
import type { Locator, Page } from "@playwright/test";
import { E2E_EVENT_HISTORY_START, E2E_INSIGHTS_EXPECTED, e2eIstDate, e2eIstMonday } from "../../scripts/lib/e2e-data.mjs";
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, isPhone, pageHeading } from "./helpers";

const glance = (page: Page) => page.getByRole("region", { name: "This week at a glance" });
const card = (page: Page, name: string) => page.getByRole("region", { name });
const barChart = (page: Page) => page.getByRole("img", { name: "Bar chart of items done per week, last 12 weeks" });
const calendar = (page: Page) => page.getByRole("img", { name: "Calendar of active days, last 26 weeks" });

/** A table's body rows as text cells: [row header, ...cells]. */
async function tableRows(table: Locator): Promise<string[][]> {
  const rows = table.locator("tbody tr");
  const out: string[][] = [];
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    out.push([(await row.locator("th").innerText()).trim(), ...(await row.locator("td").allInnerTexts()).map((t) => t.trim())]);
  }
  return out;
}

async function openTable(section: Locator): Promise<Locator> {
  await section.getByText("Show as table").click();
  await expect(section.getByText("Hide table")).toBeVisible();
  return section.getByRole("table");
}

/** The number on a tile: its visible value. */
const tileValue = (tile: Locator) => tile.locator(".type-num-lg > span").first();

test.describe("a fresh user", () => {
  test("sees zeros and each block's empty state, never anyone else's ticks", { tag: "@fresh" }, async ({ page }) => {
    // The made-up owner has nothing saved yet, while Alex Other and Riley Active have items done this
    // week (scripts/e2e-seed.mjs): none of theirs may show here.
    await gotoReady(page, "/insights");
    await expect(page).toHaveTitle("Insights · FDE Journey");
    await expect(pageHeading(page)).toHaveText("Insights");
    await expect(page.getByText(/^Mon \d{1,2} \w{3} – Sun \d{1,2} \w{3}$/)).toBeVisible();

    const tiles = glance(page).getByRole("listitem");
    await expect(tiles).toHaveCount(3);
    await expect(glance(page).getByText("0 items done this week, 0 last week")).toBeAttached();
    await expect(tiles.nth(0)).toContainText("done this week · 0 last week");
    await expect(tiles.nth(1)).toContainText("weeks in your current streak");
    await expect(tiles.nth(1)).toContainText("Mark something done this week to start one.");
    for (let i = 0; i < 3; i++) await expect(tileValue(tiles.nth(i))).toHaveText("0");
    // The owner has every section on: no hidden-sections line.
    await expect(page.getByText(/^Hidden sections aren't counted here/)).toHaveCount(0);

    await expect(card(page, "Done per week")).toContainText("Nothing marked done in the last 12 weeks. Tick your first item to start your weekly chart.");
    await expect(card(page, "Done per week").getByRole("link", { name: "Go to the Roadmap" })).toHaveAttribute("href", "/roadmap");
    await expect(card(page, "Active days")).toContainText("No activity in the last 26 weeks yet.");
    await expect(barChart(page)).toHaveCount(0);
    await expect(calendar(page)).toHaveCount(0);
    await expect(page.getByText("Show as table")).toHaveCount(0);

    await expect(card(page, "This month")).toContainText("Notes you save and learning resources you finish this month will show here.");
    await expect(card(page, "Certifications").getByText("0 of 7 done").first()).toBeAttached();
    await expect(card(page, "Current phase")).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test.describe("navigation", () => {
  test("Insights is in the sidebar right after Home", async ({ page }) => {
    test.skip(isPhone(test.info()), "desktop only");
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    const links = nav.getByRole("link");
    await expect(links.nth(0)).toHaveAccessibleName("Home");
    await expect(links.nth(1)).toHaveAccessibleName("Insights");
    await links.nth(1).click();
    await expect(page).toHaveURL("/insights");
    await expect(pageHeading(page)).toHaveText("Insights");
    await expect(pageHeading(page)).toBeFocused();
    await expect(nav.getByRole("link", { name: "Insights" })).toHaveAttribute("aria-current", "page");
  });

  test("Insights is the first row of the More sheet; the bottom bar doesn't change", async ({ page }) => {
    test.skip(!isPhone(test.info()), "phone only");
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    const bar = nav.locator(":scope > ul").last();
    await expect(bar.getByRole("link")).toHaveText(["Home", "Roadmap", "Reading", "Scaler"]);
    const more = nav.getByRole("button", { name: "More" });
    await more.click();
    const insights = nav.getByRole("link", { name: "Insights", exact: true });
    await expect(insights).toBeFocused();
    await insights.click();
    await expect(page).toHaveURL("/insights");
    await expect(pageHeading(page)).toHaveText("Insights");
    // More takes the current style; the row is current when the sheet opens again.
    await expect(more).toHaveClass(/text-accent/);
    await more.click();
    await expect(nav.getByRole("link", { name: "Insights", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("Home links to Insights with this week's numbers", async ({ page }) => {
    await gotoReady(page, "/");
    const link = page.getByRole("link", { name: /^This week: \d+ done · (\d+-week streak|no streak yet) Insights$/ });
    await expect(link).toBeVisible();
    // A real 44 px target.
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL("/insights");
    await expect(pageHeading(page)).toHaveText("Insights");
  });
});

// The made-up Insights user (one per screen size and attempt) with a few weeks of history. Serial:
// the later tests change that user's saved state.
test.describe("a user with history", () => {
  test.use({ as: "insights" });
  test.describe.configure({ mode: "serial" });

  test("tiles, charts and tables show the same numbers, and only this user's", async ({ page }) => {
    const E = E2E_INSIGHTS_EXPECTED;
    // Home's line uses the same numbers as the tiles.
    await gotoReady(page, "/");
    await expect(page.getByRole("link", { name: `This week: ${E.thisWeek} done · ${E.currentStreak}-week streak Insights` })).toBeVisible();

    await gotoReady(page, "/insights");
    const tiles = glance(page).getByRole("listitem");
    await expect(glance(page).getByText(`${E.thisWeek} items done this week, ${E.lastWeek} last week`)).toBeAttached();
    await expect(tileValue(tiles.nth(0))).toHaveText(String(E.thisWeek));
    await expect(tiles.nth(0)).toContainText(`done this week · ${E.lastWeek} last week`);
    await expect(tileValue(tiles.nth(1))).toHaveText(String(E.currentStreak));
    await expect(tiles.nth(1)).toContainText("weeks in your current streak");
    await expect(tileValue(tiles.nth(2))).toHaveText(String(E.longestStreak));
    // A new user's sections: Projects and Career off, Scaler locked (never listed).
    await expect(page.getByText("Hidden sections aren't counted here: Projects and Career.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Show them in Settings" })).toHaveAttribute("href", "/settings");

    // Done per week: the totals over the bars are the table's "Done" column, newest first.
    const weekly = card(page, "Done per week");
    await expect(barChart(page)).toBeVisible();
    const totals = (await barChart(page).locator("[data-total]").filter({ visible: true }).allInnerTexts()).map(Number);
    expect(totals).toHaveLength(12);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(E.total);
    expect(totals.at(-1)).toBe(E.thisWeek);
    await expect(weekly.getByRole("list", { name: "Colour key" }).getByRole("listitem")).toHaveText([
      "Roadmap tasks",
      "Learning resources",
      "Reading",
      "Certification prep",
      "Courses",
    ]);
    await expect(weekly.getByText(`Over the last 12 weeks you marked ${E.total} items done. This week so far: ${E.thisWeek}; last week: ${E.lastWeek}.`, { exact: false })).toBeAttached();
    const weekRows = await tableRows(await openTable(weekly));
    expect(weekRows.map((r) => Number(r[1]))).toEqual([...totals].reverse());
    expect(weekRows[0][0]).toMatch(/^\d{1,2} \w{3}\s+this week$/);
    expect(weekRows[0][2]).toBe("Roadmap tasks 1 · Learning resources 1 · Courses 1");
    expect(weekRows.map((r) => r[2]).join(" ")).not.toMatch(/Projects|Career/);
    await weekly.getByText("Hide table").click();
    await expect(weekly.getByRole("table")).toBeHidden();

    // Active days: the facts, the calendar's squares and the table agree.
    const activity = card(page, "Active days");
    await expect(calendar(page)).toBeVisible();
    const factText = await activity.locator("dd").nth(1).innerText();
    const activeDays = Number(factText.split(" ")[0]);
    const squares = calendar(page).locator("rect[data-date]");
    const counts = (await squares.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-count"))))) as number[];
    expect(counts.filter((c) => c > 0)).toHaveLength(activeDays);
    // Today has the seed's five saves (a note twice, a link, a tick and an untick) at least.
    const today = e2eIstDate(new Date());
    expect(Number(await calendar(page).locator(`rect[data-date="${today}"]`).getAttribute("data-count"))).toBeGreaterThanOrEqual(5);
    const dayRows = await tableRows(await openTable(activity));
    expect(dayRows).toHaveLength(26);
    expect(dayRows.reduce((sum, r) => sum + Number(r[1]), 0)).toBe(activeDays);
    // The window reaches back before the save history began: the estimate line says so.
    const windowStart = e2eIstDate(e2eIstMonday(Date.now(), 25));
    await expect(activity.getByText(/^Days before 26 Nov 2026 are estimated/)).toHaveCount(windowStart < E2E_EVENT_HISTORY_START ? 1 : 0);

    // This month: one item with notes saved twice counts once.
    await expect(card(page, "This month").getByText("item with a note saved", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("1");
    // Certifications: the first in rank order has 2 of its 3 prep steps done.
    const certRows = card(page, "Certifications").getByRole("listitem");
    await expect(certRows).toHaveCount(7);
    await expect(certRows.first().getByText("2 of 3 done")).toBeAttached();
  });

  test("a tick on another page changes This week after a reload", async ({ page }) => {
    const E = E2E_INSIGHTS_EXPECTED;
    await gotoReady(page, "/roadmap");
    const tick = page.locator("#item-l1-6").getByRole("checkbox");
    await expect(tick).not.toBeChecked();
    await tick.click();
    await expect(tick).toBeChecked();
    await page.waitForLoadState("networkidle");
    await gotoReady(page, "/insights");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tileValue(glance(page).getByRole("listitem").first())).toHaveText(String(E.thisWeek + 1));
    await expect(glance(page).getByText(`${E.thisWeek + 1} items done this week, ${E.lastWeek} last week`)).toBeAttached();
  });

  test("a section switched off leaves the charts and totals", async ({ page }) => {
    const E = E2E_INSIGHTS_EXPECTED;
    await gotoReady(page, "/settings");
    const reading = page.getByRole("switch", { name: "Reading" });
    await expect(reading).toBeChecked();
    await reading.click();
    await expect(reading).not.toBeChecked();
    await page.waitForLoadState("networkidle");

    await gotoReady(page, "/insights");
    await expect(page.getByText("Hidden sections aren't counted here: Reading, Projects and Career.")).toBeVisible();
    // Last week's paper no longer counts.
    await expect(glance(page).getByText(new RegExp(`items? done this week, ${E.lastWeek - 1} last week$`))).toBeAttached();
    const weekly = card(page, "Done per week");
    await expect(weekly.getByRole("list", { name: "Colour key" }).getByRole("listitem")).toHaveText(["Roadmap tasks", "Learning resources", "Certification prep", "Courses"]);
    const rows = await tableRows(await openTable(weekly));
    expect(rows.map((r) => r[2]).join(" ")).not.toContain("Reading");
  });

  test("never scrolls sideways, from 320 to 1920 px", async ({ page }) => {
    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/insights");
      await expect(barChart(page)).toBeVisible();
      await openTable(card(page, "Done per week"));
      await openTable(card(page, "Active days"));
      await expectNoSidewaysScroll(page);
    }
  });
});
