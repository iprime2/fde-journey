// Ticks: saving, counts, a failed save and being signed out while using the app.
// Every test here saves, so each uses its own items, different on desktop and phone (helpers.ts).
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  SAVE_FAILED_TEXT,
  SIGNED_OUT_TEXT,
  failSaves,
  forProject,
  gotoReady,
  isPhone,
  replaceSessionCookie,
} from "./helpers";

/** The card's own count, read from its "N of M done" text. */
async function cardDone(card: Locator): Promise<number> {
  const text = await card.getByText(/^\d+ of \d+ done$/).first().textContent();
  return Number(text?.split(" ")[0]);
}

/** Start from an unticked box, whatever an earlier (retried) run left behind. */
async function untick(page: Page, tick: Locator) {
  if (await tick.isChecked()) {
    await tick.click();
    await expect(tick).not.toBeChecked();
    await page.waitForLoadState("networkidle");
  }
}

test.describe("ticking items", () => {
  test("a tick saves at once, survives a reload, updates the counts, and unticks", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { path: "/career", title: "Start job applications", card: "Career milestones" },
      { path: "/projects", title: "Build research planning and tool registry", card: "Project 3 — AI Research Agent" },
    );
    await gotoReady(page, item.path);
    const tick = page.getByRole("checkbox", { name: `Mark done: ${item.title}` });
    const card = page.locator("section", { has: page.getByRole("heading", { level: 2, name: item.card }) });
    await untick(page, tick);
    const before = await cardDone(card);

    await tick.click();
    await expect(tick).toBeChecked();
    await expect.poll(() => cardDone(card)).toBe(before + 1);
    if (!isPhone(testInfo)) {
      // The sidebar count comes from the same save (the page refreshes in the action's response).
      const nav = page.getByRole("navigation", { name: "Sections" });
      await expect(nav.getByRole("link", { name: `Career ${before + 1} of 4 done` })).toBeVisible();
    }

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tick).toBeChecked();
    expect(await cardDone(card)).toBe(before + 1);

    await tick.click();
    await expect(tick).not.toBeChecked();
    await expect.poll(() => cardDone(card)).toBe(before);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tick).not.toBeChecked();
  });
});

test.describe("when a save fails", () => {
  // The test cuts the save request, so the browser logs the failed request on purpose.
  test.use({ allowedConsoleErrors: [/Failed to load resource: net::ERR_FAILED/] });

  test("the tick goes back, says so, and Try again saves it", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c2-1", title: "Verify organization and exam eligibility" },
      { id: "c3-1", title: "Study Bedrock, RAG and agent domains" },
    );
    await gotoReady(page, "/certs");
    const row = page.locator(`#item-${item.id}`);
    const tick = row.getByRole("checkbox", { name: `Mark done: ${item.title}` });
    await untick(page, tick);

    const restore = await failSaves(page, "/certs");
    await tick.click();
    await expect(row.getByText("Couldn't save this tick.")).toBeVisible();
    await expect(tick).not.toBeChecked();
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toBeVisible();

    await restore();
    await row.getByRole("button", { name: "Try again" }).click();
    await expect(tick).toBeChecked();
    await expect(row.getByText("Couldn't save this tick.")).toBeHidden();
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toBeHidden();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tick).toBeChecked();
    await untick(page, tick);
  });

  test("a note keeps its text, shows Not saved, and Try again saves it", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-3", title: "Implement embeddings, indexing and hybrid retrieval" },
      { id: "p2-3", title: "Add tool permissions and human approval" },
    );
    const text = `Draft for ${item.id}: kept while the connection is down.`;
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);

    const restore = await failSaves(page, "/projects");
    await row.getByRole("button", { name: /^(Add|Edit) note$/ }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    await note.fill(text);
    await expect(row.getByText("Not saved")).toBeVisible();
    await expect(note).toHaveValue(text);
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toBeVisible();

    await restore();
    await row.getByRole("button", { name: "Try again" }).click();
    await expect(row.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toBeHidden();

    // Clean up for a retried run.
    await note.fill("");
    await note.blur();
    await expect(row.getByText("Saved", { exact: true })).toBeVisible();
  });
});

test.describe("signed out while using the app", () => {
  test("a refused save explains, offers Sign in, and keeps typed text", async ({ page, baseURL }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c4-1", title: "Study official skills outline" },
      { id: "c5-1", title: "Review official exam objectives" },
    );
    await gotoReady(page, "/certs");
    const row = page.locator(`#item-${item.id}`);
    const tick = row.getByRole("checkbox", { name: `Mark done: ${item.title}` });
    await row.getByRole("button", { name: /^(Add|Edit) note$/ }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });

    // The sign-in ends (only for this browser; the shared test session stays valid).
    await replaceSessionCookie(page, baseURL);
    await note.fill("Typed after the sign-in ended.");
    await tick.click();

    const banner = page.getByRole("alert").filter({ hasText: SIGNED_OUT_TEXT });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fcerts");
    await expect(tick).not.toBeChecked();
    await expect(tick).toBeDisabled();
    // Typed text stays in place; the fields are now read-only.
    await expect(note).toHaveValue("Typed after the sign-in ended.");
    await expect(note).not.toBeEditable();
  });
});
