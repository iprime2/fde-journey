// Courses & badges (/courses): every course grouped by provider, its chips, ticks, notes, search,
// the badge and phase filter, the navigation item and the layout at phone and desktop width.
// Tests that save use course ids no other test uses, different on desktop and phone (helpers.ts).
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { EXAMPLE_NOTE, announced, expectNoSidewaysScroll, forProject, gotoReady, isPhone, pageHeading, shownLine } from "./helpers";

const PROVIDER_CARDS = ["OpenAI developer tracks", "OpenAI Academy · Build with AI", "Anthropic Claude Academy"];

/** The value beside a header fact ("Done", "Badges earned"). */
const fact = (page: Page, label: string) => page.locator("header dl > div").filter({ has: page.locator("dt", { hasText: label }) }).locator("dd");

const card = (page: Page, title: string) => page.locator("section", { has: page.getByRole("heading", { level: 2, name: title }) });

const ticks = (scope: Page | Locator) => scope.getByRole("checkbox", { name: /^Mark done: / });

/** "3 of 27" -> 3. */
const firstNumber = async (l: Locator) => Number((await l.textContent())?.split(" ")[0]);

test.describe("courses and badges", () => {
  test("lists all 27 courses, grouped by provider, with their chips and links", async ({ page }) => {
    await gotoReady(page, "/courses");
    await expect(pageHeading(page)).toHaveText("Courses & badges");
    await expect(page).toHaveTitle("Courses & badges · FDE Journey");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(PROVIDER_CARDS);
    await expect(ticks(page)).toHaveCount(27);
    await expect(ticks(card(page, "OpenAI developer tracks"))).toHaveCount(3);
    await expect(ticks(card(page, "OpenAI Academy · Build with AI"))).toHaveCount(8);
    await expect(ticks(card(page, "Anthropic Claude Academy"))).toHaveCount(16);

    // Header facts that don't depend on progress.
    await expect(fact(page, "Courses")).toHaveText("27");
    await expect(fact(page, "Stated length")).toHaveText("44–49 h · 19 courses");

    // A course with a badge: the Badge chip, its phase, length as meta, and a title link to a new tab.
    const api = page.locator("#item-cr12");
    await expect(api.getByText("Badge", { exact: true })).toBeVisible();
    await expect(api.getByText("Phase 1 · Foundations", { exact: true })).toBeVisible();
    await expect(api.getByText("67 lessons · 9 h", { exact: true })).toBeVisible();
    const link = api.getByRole("link", { name: /^Building with the Claude API/ });
    await expect(link).toHaveAttribute("href", "https://academy.claude.com/courses/building-with-the-claude-api");
    await expect(link).toHaveAttribute("target", "_blank");

    // A course without a badge: only its phase chip, length and level as meta.
    const tracks = page.locator("#item-cr1");
    await expect(tracks.getByText("Badge", { exact: true })).toHaveCount(0);
    await expect(tracks.getByText("2–4 h · Intermediate", { exact: true })).toBeVisible();

    // A top pick says so, and why.
    const pick = page.locator("#item-cr25");
    await expect(pick.getByText("Top pick", { exact: true })).toBeVisible();
    await expect(pick.getByText("For the FDE role: lines up with the AWS certifications.")).toBeVisible();
    await expect(page.getByText("Top pick", { exact: true })).toHaveCount(5);

    // The small print and its sources.
    await expect(page.getByText("Lengths and badges from the providers' pages, checked 26 Nov 2026.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /^OpenAI Academy courses/ })).toHaveAttribute("href", "https://academy.openai.com/pages/courses");
  });

  test("a tick saves, counts towards badges earned and survives a reload", async ({ page }, testInfo) => {
    // Both give a badge. No other test touches these ids.
    const item = forProject(
      testInfo,
      { id: "cr13", title: "Claude Platform 101", card: "Anthropic Claude Academy" },
      { id: "cr9", title: "Get Started with Codex", card: "OpenAI Academy · Build with AI" },
    );
    await gotoReady(page, "/courses");
    const tick = page.getByRole("checkbox", { name: `Mark done: ${item.title}` });
    if (await tick.isChecked()) {
      // A retried run starts from an unticked box.
      await tick.click();
      await expect(tick).not.toBeChecked();
      await page.waitForLoadState("networkidle");
    }
    const doneBefore = await firstNumber(fact(page, "Done"));
    const badgesBefore = await firstNumber(fact(page, "Badges earned"));

    await tick.click();
    await expect(tick).toBeChecked();
    await expect.poll(() => firstNumber(fact(page, "Done"))).toBe(doneBefore + 1);
    await expect.poll(() => firstNumber(fact(page, "Badges earned"))).toBe(badgesBefore + 1);
    if (!isPhone(testInfo)) {
      const nav = page.getByRole("navigation", { name: "Sections" });
      await expect(nav.getByRole("link", { name: `Courses ${doneBefore + 1} of 27 done` })).toBeVisible();
    }

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tick).toBeChecked();
    await expect(fact(page, "Done")).toHaveText(`${doneBefore + 1} of 27`);

    await tick.click();
    await expect(tick).not.toBeChecked();
    await expect.poll(() => firstNumber(fact(page, "Done"))).toBe(doneBefore);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tick).not.toBeChecked();
  });

  test("a note on a course saves and survives a reload", async ({ page }, testInfo) => {
    const item = forProject(testInfo, { id: "cr18", title: "Introduction to Model Context Protocol" }, { id: "cr19", title: "Model Context Protocol: Advanced topics" });
    await gotoReady(page, "/courses");
    const row = page.locator(`#item-${item.id}`);
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    const edit = row.getByRole("button", { name: /^(Add note|Edit note)$/ });
    await edit.click();
    await expect(note).toBeFocused();
    await note.fill("");
    await note.pressSequentially(EXAMPLE_NOTE);
    await expect(shownLine(row, "Saved")).toBeVisible();
    await expect(announced(row)).toHaveText("Saved");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText(EXAMPLE_NOTE)).toBeVisible();
    await expect(row.getByRole("button", { name: "Edit note" })).toBeVisible();
  });

  test("search filters the courses and keeps the cards that match", async ({ page }) => {
    await gotoReady(page, "/courses");
    const search = page.getByRole("searchbox", { name: "Search this page" });
    await expect(search).toHaveAttribute("placeholder", "Search courses…");
    await search.fill("bedrock");
    await expect(ticks(page).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole("checkbox", { name: "Mark done: Claude with Amazon Bedrock" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "OpenAI developer tracks" })).toBeHidden();
    await expect(page).toHaveURL("/courses?q=bedrock");

    // The provider and the chips are searchable too.
    await search.fill("openai academy");
    await expect(ticks(page).filter({ visible: true })).toHaveCount(8);

    await search.fill("no course has this");
    await expect(page.getByText("Nothing matches this search or filter.")).toBeVisible();
    await page.getByRole("button", { name: "Clear search and filter" }).click();
    await expect(search).toBeFocused();
    await expect(ticks(page).filter({ visible: true })).toHaveCount(27);
  });

  test("the badge, pick and phase filter narrows the list and stays in the address", async ({ page }) => {
    await gotoReady(page, "/courses");
    const filter = page.getByRole("combobox", { name: "Badge, pick or phase" });
    await expect(filter).toHaveValue("");

    await filter.selectOption({ label: "With a badge" });
    await expect(ticks(page).filter({ visible: true })).toHaveCount(21);
    await expect(page.locator("#item-cr21")).toBeHidden();
    await expect(page).toHaveURL("/courses?tag=badge");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(filter).toHaveValue("badge");
    await expect(ticks(page).filter({ visible: true })).toHaveCount(21);

    await filter.selectOption({ label: "Phase 6 · AWS cloud and deployment" });
    await expect(ticks(page).filter({ visible: true })).toHaveCount(1);
    await expect(page.locator("#item-cr25")).toBeVisible();
    // Only the Anthropic card has a match.
    await expect(page.getByRole("heading", { level: 2 }).filter({ visible: true })).toHaveText(["Anthropic Claude Academy"]);

    await filter.selectOption({ label: "Top picks" });
    await expect(ticks(page).filter({ visible: true })).toHaveCount(5);

    await filter.selectOption({ label: "All courses" });
    await expect(ticks(page).filter({ visible: true })).toHaveCount(27);
    await expect(page).toHaveURL("/courses");
  });

  test("fits the screen at 320, 390 and 1280 px", async ({ page }) => {
    test.skip(isPhone(test.info()), "sets its own screen sizes");
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/courses");
      await expectNoSidewaysScroll(page);
      // The longest phase chip stays inside its row.
      const chip = page.locator("#item-cr25").getByText("Phase 6 · AWS cloud and deployment", { exact: true });
      const [chipBox, rowBox] = [await boxOf(chip), await boxOf(page.locator("#item-cr25"))];
      expect(chipBox.x + chipBox.width, `${width} px`).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    }
  });
});

async function boxOf(l: Locator) {
  const box = await l.boundingBox();
  if (!box) throw new Error("not visible");
  return box;
}

test.describe("navigation to Courses", () => {
  test("is always in the menu and marks the page as current", async ({ page }, testInfo) => {
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    if (isPhone(testInfo)) {
      // Owner: Home, Roadmap, Reading and Scaler in the bar; Courses in the More sheet.
      const more = nav.getByRole("button", { name: "More" });
      await more.click();
      await nav.getByRole("link", { name: "Courses", exact: true }).click();
      await expect(page).toHaveURL("/courses");
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await more.click();
      await expect(nav.getByRole("link", { name: "Courses", exact: true })).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
    } else {
      const link = nav.getByRole("link", { name: /^Courses \d+ of 27 done$/ });
      await expect(link).toHaveAttribute("href", "/courses");
      await link.click();
      await expect(page).toHaveURL("/courses");
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(pageHeading(page)).toBeFocused();
    }
    await expect(pageHeading(page)).toHaveText("Courses & badges");
  });

  test("has a tile on Home", async ({ page }) => {
    await gotoReady(page, "/");
    const tile = page.getByRole("region", { name: "Summary" }).getByRole("link", { name: /Courses done/ });
    await expect(tile).toHaveAttribute("href", "/courses");
    await expect(tile).toHaveAccessibleName(/^\d+ of 27 done, Courses done · \d+ badges? earned$/);
  });
});
