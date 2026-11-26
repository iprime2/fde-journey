// Notes, links and the weekly notes. Every test here saves, so each uses its own items, different
// on desktop and phone (helpers.ts); the weekly notes are a single record, so only one project
// writes them.
import type { Locator, Page, Request } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  EXAMPLE_LINK,
  EXAMPLE_NOTE,
  SAVE_FAILED_TEXT,
  WAITING_TEXT,
  announced,
  failSaves,
  forProject,
  gotoReady,
  isPhone,
  pageHeading,
  shownLine,
} from "./helpers";

const isSaveRequest = (request: Request) => request.method() === "POST" && !!request.headers()["next-action"];

/** Empties a row's note and link, so a retried run starts clean. */
async function clearNote(page: Page, row: Locator, title: string) {
  const edit = row.getByRole("button", { name: "Edit note" });
  if (!(await edit.isVisible())) return;
  await edit.click();
  for (const field of [row.getByRole("textbox", { name: `Note for ${title}` }), row.getByRole("textbox", { name: `Link for ${title}` })]) {
    if ((await field.inputValue()) === "") continue;
    // Both fields share one status line, so wait for this field's own save before reading it.
    const saved = page.waitForResponse((r) => isSaveRequest(r.request()));
    await field.fill("");
    await field.blur();
    await saved;
    await expect(announced(row)).toHaveText("Saved");
  }
  await row.getByRole("button", { name: "Hide note" }).click();
  await expect(row.getByRole("button", { name: "Add note" })).toBeVisible();
}

/** Holds every save request on `path` until `release()` is called. */
async function holdSaves(page: Page, path: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let arrived!: () => void;
  const firstArrived = new Promise<void>((resolve) => (arrived = resolve));
  await page.route(`**${path}`, async (route) => {
    if (!isSaveRequest(route.request())) return route.continue();
    arrived();
    await released;
    // Offline by now, the request fails as a dropped connection would.
    await route.continue().catch(() => {});
  });
  return { firstArrived, release, stop: () => page.unroute(`**${path}`) };
}

test.describe("notes", () => {
  test("a note saves after a pause and on blur, survives a reload, and can be edited and hidden", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-1", title: "Complete system requirements and architecture" },
      { id: "p2-1", title: "Integrate Prometheus metrics and application logs" },
    );
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    // Opening the editor focuses the note.
    const button = row.getByRole("button", { name: "Add note" });
    await button.click();
    await expect(row.getByRole("button", { name: "Hide note" })).toHaveAttribute("aria-expanded", "true");
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    await expect(note).toBeFocused();

    // Saves after typing stops, while the field still has focus.
    await note.pressSequentially(EXAMPLE_NOTE);
    await expect(shownLine(row, "Saved")).toBeVisible();
    await expect(announced(row)).toHaveText("Saved");
    await expect(note).toBeFocused();

    // The page's clock is controlled from here on (it runs normally until paused).
    await page.clock.install();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByRole("button", { name: "Edit note" })).toBeVisible();
    await expect(row.getByText(EXAMPLE_NOTE)).toBeVisible();

    // Edit, then leave the field: the save starts at once. The clock is paused, so the 800 ms
    // pause after typing can never end: only the blur can have started this save.
    await row.getByRole("button", { name: "Edit note" }).click();
    await expect(note).toHaveValue(EXAMPLE_NOTE);
    await page.clock.pauseAt(Date.now() + 1_000);
    await note.fill(`${EXAMPLE_NOTE} Edited.`);
    const saveRequest = page.waitForRequest(isSaveRequest);
    await note.blur();
    await saveRequest;
    await expect(announced(row)).toHaveText("Saved");
    await page.clock.resume();

    // Escape closes the editor and returns focus to the button.
    await note.focus();
    await page.keyboard.press("Escape");
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(edit).toBeFocused();
    await expect(edit).toHaveAttribute("aria-expanded", "false");
    await expect(note).toBeHidden();
    await expect(row.getByText(`${EXAMPLE_NOTE} Edited.`)).toBeVisible();
    // A saved note's row shows no line and the button has no description.
    await expect(shownLine(row, "Saved")).toHaveCount(0);
    await expect(edit).toHaveAccessibleDescription("");

    // Hide note closes it too.
    await edit.click();
    await row.getByRole("button", { name: "Hide note" }).click();
    await expect(note).toBeHidden();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText(`${EXAMPLE_NOTE} Edited.`)).toBeVisible();
    await clearNote(page, row, item.title);
  });

  test("leaving the field while a save is on its way ends at Saved, not Saving…", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-4", title: "Add multi-tenancy, authorization and deletion handling" },
      { id: "p2-4", title: "Implement audit logs and recovery verification" },
    );
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    const hold = await holdSaves(page, "/projects");
    await row.getByRole("button", { name: "Add note" }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    await note.fill(`Draft for ${item.id}: held on its way.`);
    // The save after the 800 ms pause is held; leave the field while it is.
    await hold.firstArrived;
    await expect(row.getByText("Saving…")).toBeVisible();
    // "Saving…" is shown, never announced.
    await expect(announced(row)).toHaveText("");
    await note.blur();
    hold.release();
    await expect(announced(row)).toHaveText("Saved");
    await expect(row.getByText("Saving…")).toBeHidden();
    await hold.stop();

    // Closing with Escape while a save is held: the row only says "Saving…" once it has run for
    // 1 s, and the line goes when it is saved.
    const slow = await holdSaves(page, "/projects");
    await note.focus();
    await note.fill(`Draft for ${item.id}: closed while saving.`);
    await page.keyboard.press("Escape");
    await slow.firstArrived;
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(edit).toBeFocused();
    await expect(row.getByText("Saving…")).toBeVisible();
    await expect(edit).toHaveAccessibleDescription("Saving…");
    slow.release();
    await expect(row.getByText("Saving…")).toBeHidden();
    await expect(announced(row)).not.toContainText("Not saved");
    await expect(edit).toHaveAccessibleDescription("");
    await slow.stop();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText(`Draft for ${item.id}: closed while saving.`)).toBeVisible();
    await clearNote(page, row, item.title);
  });

  test("a change typed just before going offline waits, then saves by itself when the connection returns", async ({ page, context }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-5", title: "Add evaluation, observability and load testing" },
      { id: "p2-5", title: "Test failure scenarios and document results" },
    );
    const text = `Offline draft for ${item.id}.`;
    await page.clock.install();
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    await row.getByRole("button", { name: "Add note" }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    // The clock is paused, so the connection is gone before the 800 ms pause after typing ends.
    await page.clock.pauseAt(Date.now() + 1_000);
    await note.fill("Offline draft");
    await context.setOffline(true);
    await expect(shownLine(row, WAITING_TEXT)).toBeVisible();
    await expect(announced(row)).toHaveText(WAITING_TEXT);
    await page.clock.resume();
    // The field stays editable offline; more typing waits too.
    await expect(note).toBeEditable();
    await note.fill(text);
    await expect(shownLine(row, WAITING_TEXT)).toBeVisible();

    // Closed, the row keeps saying so, and the note button reads it.
    await page.keyboard.press("Escape");
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(edit).toBeFocused();
    await expect(row.getByText(text)).toBeVisible();
    await expect(shownLine(row, WAITING_TEXT)).toBeVisible();
    await expect(edit).toHaveAccessibleDescription(WAITING_TEXT);
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toHaveCount(0);

    const saved = page.waitForResponse((r) => isSaveRequest(r.request()));
    await context.setOffline(false);
    expect((await saved).ok()).toBe(true);
    await expect(shownLine(row, WAITING_TEXT)).toHaveCount(0);
    await expect(announced(row)).not.toContainText("Not saved");

    // Another page sees it.
    const other = await context.newPage();
    await gotoReady(other, "/projects");
    await expect(other.locator(`#item-${item.id}`).getByText(text)).toBeVisible();
    await other.close();
    await clearNote(page, row, item.title);
  });

  test.describe("when the connection drops during a save", () => {
    test.use({ allowedConsoleErrors: [/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/] });

    test("the save on its way counts as not saved yet, and saves when the connection returns", async ({ page, context }, testInfo) => {
      const item = forProject(
        testInfo,
        { id: "p3-4", title: "Generate structured reports with citations" },
        { id: "p3-5", title: "Evaluate quality, test and publish demonstration" },
      );
      const text = `Draft for ${item.id}: sent just as the connection dropped.`;
      await gotoReady(page, "/projects");
      const row = page.locator(`#item-${item.id}`);
      await clearNote(page, row, item.title);

      const hold = await holdSaves(page, "/projects");
      await row.getByRole("button", { name: "Add note" }).click();
      await row.getByRole("textbox", { name: `Note for ${item.title}` }).fill(text);
      await hold.firstArrived;
      await context.setOffline(true);
      await expect(shownLine(row, WAITING_TEXT)).toBeVisible();
      // The held save now fails; it still only waits, with no failure banner.
      hold.release();
      await hold.stop();
      await expect(shownLine(row, WAITING_TEXT)).toBeVisible();
      await expect(announced(row)).not.toContainText("Not saved.");
      await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toHaveCount(0);

      const saved = page.waitForResponse((r) => isSaveRequest(r.request()));
      await context.setOffline(false);
      expect((await saved).ok()).toBe(true);
      await expect(announced(row)).toHaveText("Saved");

      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(row.getByText(text)).toBeVisible();
      await clearNote(page, row, item.title);
    });
  });

  test("a change typed just before going Back saves, though the field was never left", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c1-1", title: "Review official exam guide and domains" },
      { id: "c1-2", title: "Complete practice questions and review weak areas" },
    );
    const text = `Draft for ${item.id}: typed just before going back.`;
    await page.clock.install();
    await gotoReady(page, "/");
    // A visit inside the app, so Back keeps the page mounted but hidden (React Activity).
    await page.getByRole("link", { name: /Certifications passed/ }).click();
    await expect(pageHeading(page)).toHaveText("Certifications");
    await page.waitForLoadState("networkidle");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    await row.getByRole("button", { name: "Add note" }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    // The clock is paused, so the 800 ms pause after typing can't end: only hiding the page can
    // start this save.
    await page.clock.pauseAt(Date.now() + 1_000);
    await note.fill(text);
    const saved = page.waitForResponse((r) => isSaveRequest(r.request()));
    await page.goBack();
    await expect(pageHeading(page)).toHaveText("FDE Journey");
    expect((await saved).ok()).toBe(true);
    await page.clock.resume();

    await gotoReady(page, "/certs");
    await expect(row.getByText(text)).toBeVisible();
    await clearNote(page, row, item.title);
  });

  test("a link must be https: bad links show the error and aren't saved; a good one becomes a link", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-2", title: "Implement document ingestion and asynchronous processing" },
      { id: "p2-2", title: "Build incident investigation workflow" },
    );
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    await row.getByRole("button", { name: "Add note" }).click();
    const link = row.getByRole("textbox", { name: `Link for ${item.title}` });
    for (const bad of ["javascript:alert(1)", "http://example.com/demo"]) {
      await link.fill(bad);
      await link.blur();
      const error = row.getByText("Links must start with https://", { exact: true });
      await expect(error).toBeVisible();
      await expect(link).toHaveAttribute("aria-invalid", "true");
      await expect(link).toHaveAttribute("aria-describedby", (await error.getAttribute("id")) ?? "");
      await expect(announced(row)).toHaveText("Link not saved. Links must start with https://");
    }
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByRole("button", { name: "Add note" })).toBeVisible();

    await row.getByRole("button", { name: "Add note" }).click();
    await link.fill(EXAMPLE_LINK);
    await link.blur();
    await expect(announced(row)).toHaveText("Saved");
    await expect(link).not.toHaveAttribute("aria-invalid", "true");

    await page.reload();
    await page.waitForLoadState("networkidle");
    const preview = row.getByRole("link", { name: new RegExp(EXAMPLE_LINK.replaceAll(".", "\\.")) });
    await expect(preview).toHaveAttribute("href", EXAMPLE_LINK);
    await expect(preview).toHaveAttribute("target", "_blank");
    await clearNote(page, row, item.title);
  });

  test("a link that isn't https stays visible after Hide note, with Fix link", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p3-2", title: "Integrate search and source retrieval" },
      { id: "p3-3", title: "Implement context management and memory" },
    );
    const bad = "www.example.com/demo";
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    await row.getByRole("button", { name: "Add note" }).click();
    const link = row.getByRole("textbox", { name: `Link for ${item.title}` });
    await link.fill(bad);
    await row.getByRole("button", { name: "Hide note" }).click();

    // Closed at once. The preview shows what was typed (as plain text: it isn't https), the
    // button says Edit note, and the line says what's wrong.
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(link).toBeHidden();
    await expect(edit).toBeFocused();
    await expect(row.getByText(bad, { exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: /www\.example\.com/ })).toHaveCount(0);
    const message = "Link not saved. Links must start with https://";
    await expect(shownLine(row, message)).toBeVisible();
    await expect(edit).toHaveAccessibleDescription(message);
    // The announcement is the words only; Fix link stays outside it.
    await expect(announced(row)).toHaveText(message);
    await expect(announced(row).getByRole("button")).toHaveCount(0);
    const fix = row.getByRole("button", { name: "Fix link" });
    await expect(fix).toHaveAccessibleDescription(message);
    expect((await fix.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    // Fix link opens the editor on the link field, with its error.
    await fix.click();
    await expect(link).toBeFocused();
    await expect(link).toHaveValue(bad);
    await expect(link).toHaveAttribute("aria-invalid", "true");
    await expect(row.getByText("Links must start with https://", { exact: true })).toBeVisible();

    // Emptying it leaves nothing to save.
    await link.fill("");
    await row.getByRole("button", { name: "Hide note" }).click();
    await expect(row.getByRole("button", { name: "Add note" })).toBeVisible();
    await expect(shownLine(row, message)).toHaveCount(0);
    await expect(announced(row)).toHaveText("");
  });

  test("a note over 10,000 characters isn't saved: the closed row says so, and Fix note opens the note", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c4-2", title: "Complete Microsoft Learn modules and labs" },
      { id: "c5-2", title: "Study LLM and GenAI application concepts" },
    );
    const tooLong = "Long made-up draft. ".repeat(501); // 10,020 characters
    await gotoReady(page, "/certs");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);
    let sent = 0;
    page.on("request", (r) => {
      if (isSaveRequest(r)) sent += 1;
    });

    await row.getByRole("button", { name: "Add note" }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    await note.fill(tooLong);
    await row.getByRole("button", { name: "Hide note" }).click();

    const message = "Note not saved. Notes can be up to 10,000 characters.";
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(shownLine(row, message)).toBeVisible();
    await expect(edit).toHaveAccessibleDescription(message);
    await expect(announced(row)).toHaveText(message);
    const fix = row.getByRole("button", { name: "Fix note" });
    await expect(fix).toHaveAccessibleDescription(message);

    // Fix note opens the editor on the note, with its error.
    await fix.click();
    await expect(note).toBeFocused();
    await expect(note).toHaveAttribute("aria-invalid", "true");
    await expect(row.getByText("Notes can be up to 10,000 characters.", { exact: true })).toBeVisible();
    // Still too long after a keystroke: the message stays.
    await note.press("End");
    await note.press("Backspace");
    await expect(row.getByText("Notes can be up to 10,000 characters.", { exact: true })).toBeVisible();
    // The same rule as the server's, checked first: nothing was sent.
    expect(sent).toBe(0);

    await note.fill("");
    await row.getByRole("button", { name: "Hide note" }).click();
    await expect(row.getByRole("button", { name: "Add note" })).toBeVisible();
    await expect(shownLine(row, message)).toHaveCount(0);
  });
});

test.describe("a note that fails to save", () => {
  // The tests cut save requests, so the browser logs the failed requests on purpose.
  test.use({ allowedConsoleErrors: [/Failed to load resource: net::ERR_FAILED/] });

  test("stays visible after Escape: Not saved. with Try again, which saves it and keeps focus on the note button", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-6", title: "Deploy and publish a reproducible demo" },
      { id: "p2-6", title: "Integrate a ticketing or Slack connector with human approval" },
    );
    const text = `Draft for ${item.id}: closed while the save fails.`;
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    const restore = await failSaves(page, "/projects");
    await row.getByRole("button", { name: "Add note" }).click();
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    await note.fill(text);
    await page.keyboard.press("Escape");

    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(edit).toBeFocused();
    await expect(note).toBeHidden();
    await expect(row.getByText(text)).toBeVisible();
    await expect(shownLine(row, "Not saved.")).toBeVisible();
    await expect(announced(row)).toHaveText("Not saved.");
    await expect(edit).toHaveAccessibleDescription("Not saved.");
    const tryAgain = row.getByRole("button", { name: "Try again" });
    await expect(tryAgain).toHaveAccessibleDescription("Not saved.");
    expect((await tryAgain.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toBeVisible();

    await restore();
    await tryAgain.click();
    await expect(edit).toBeFocused();
    await expect(shownLine(row, "Not saved.")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toBeHidden();
    await expect(edit).toBeFocused();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText(text)).toBeVisible();
    await clearNote(page, row, item.title);
  });

  test("with the keyboard: Tab from the field reaches Try again, and Enter saves with focus on the note button", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c6-2", title: "Review Gemini and Google Cloud AI offerings" },
      { id: "c7-2", title: "Complete architecture labs" },
    );
    await gotoReady(page, "/certs");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    const restore = await failSaves(page, "/certs");
    await row.getByRole("button", { name: "Add note" }).click();
    const link = row.getByRole("textbox", { name: `Link for ${item.title}` });
    await link.fill(EXAMPLE_LINK);
    // The save after the typing pause fails while focus is still in the field.
    await expect(shownLine(row, "Not saved.")).toBeVisible();
    await expect(link).toBeFocused();

    await page.keyboard.press("Tab");
    const tryAgain = row.getByRole("button", { name: "Try again" });
    await expect(tryAgain).toBeFocused();
    await expect(shownLine(row, "Not saved.")).toBeVisible();

    await restore();
    await page.keyboard.press("Enter");
    await expect(row.getByRole("button", { name: "Hide note" })).toBeFocused();
    await expect(announced(row)).toHaveText("Saved");
    await clearNote(page, row, item.title);
  });

  test("saves by itself, once, when the connection drops and comes back", async ({ page, context }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c2-3", title: "Practice architecture and agent scenarios" },
      { id: "c3-3", title: "Take timed mock exams" },
    );
    const text = `Draft for ${item.id}: failed, then saved once back online.`;
    await gotoReady(page, "/certs");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    const restore = await failSaves(page, "/certs");
    await row.getByRole("button", { name: "Add note" }).click();
    await row.getByRole("textbox", { name: `Note for ${item.title}` }).fill(text);
    await page.keyboard.press("Escape");
    await expect(shownLine(row, "Not saved.")).toBeVisible();
    // Focus on Try again when it goes away (offline): focus moves to the note button, not the page.
    await page.keyboard.press("Tab");
    const tryAgain = row.getByRole("button", { name: "Try again" });
    await expect(tryAgain).toBeFocused();

    await context.setOffline(true);
    await expect(shownLine(row, WAITING_TEXT)).toBeVisible();
    await expect(tryAgain).toHaveCount(0);
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(edit).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: SAVE_FAILED_TEXT })).toHaveCount(0);

    await restore();
    const saved = page.waitForResponse((r) => isSaveRequest(r.request()));
    await context.setOffline(false);
    expect((await saved).ok()).toBe(true);
    await expect(shownLine(row, WAITING_TEXT)).toHaveCount(0);
    await expect(shownLine(row, "Not saved.")).toHaveCount(0);
    await expect(edit).toHaveAccessibleDescription("");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText(text)).toBeVisible();
    await clearNote(page, row, item.title);
  });
});

test.describe("weekly notes", () => {
  // The desktop test cuts one save on purpose, so the browser logs the failed request.
  test.use({ allowedConsoleErrors: [/Failed to load resource: net::ERR_FAILED/] });

  test("save and survive a reload; Try again with the keyboard after a failure", async ({ page }, testInfo) => {
    // One record shared by both projects: only the desktop run writes it.
    test.skip(isPhone(testInfo), "the weekly notes are one record; the desktop run saves them");
    await gotoReady(page, "/career");
    const card = page.locator("#item-journal");
    const journal = page.getByRole("textbox", { name: "Weekly notes" });
    const text = "Week of 30 Nov: finished Phase 1. Next: the retrieval prototype.";
    await journal.fill(text);
    await expect(announced(card)).toHaveText("Saved");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(journal).toHaveValue(text);

    // A failed save, with focus still in the textarea: Tab reaches Try again (the blur doesn't
    // save again and remove it), and Enter saves with focus back in the textarea.
    const restore = await failSaves(page, "/career");
    await journal.fill(`${text} Draft while saves fail.`);
    await expect(shownLine(card, "Not saved.")).toBeVisible();
    await expect(journal).toBeFocused();
    await page.keyboard.press("Tab");
    const tryAgain = card.getByRole("button", { name: "Try again" });
    await expect(tryAgain).toBeFocused();
    await expect(tryAgain).toHaveAccessibleDescription("Not saved.");
    expect((await tryAgain.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await restore();
    await page.keyboard.press("Enter");
    await expect(journal).toBeFocused();
    await expect(announced(card)).toHaveText("Saved");

    const cleared = page.waitForResponse((r) => isSaveRequest(r.request()));
    await journal.fill("");
    await journal.blur();
    await cleared;
    await expect(announced(card)).toHaveText("Saved");
  });

  test("stay editable offline: a change waits for the connection, and stops waiting when undone", async ({ page, context }) => {
    // Saves nothing: the text goes back to what was saved before the connection returns.
    await page.clock.install();
    await gotoReady(page, "/career");
    const card = page.locator("#item-journal");
    const journal = page.getByRole("textbox", { name: "Weekly notes" });
    const before = await journal.inputValue();
    await context.setOffline(true);
    await expect(journal).toBeEditable();
    await journal.fill(`${before} Offline draft.`);
    await expect(shownLine(card, WAITING_TEXT)).toBeVisible();
    // Back to the saved text: the line goes at once. The clock is paused, so it can't be the
    // save attempt after the typing pause that clears it.
    await page.clock.pauseAt(Date.now() + 1_000);
    await journal.fill(before);
    await expect(shownLine(card, WAITING_TEXT)).toHaveCount(0);
    await expect(announced(card)).toHaveText("");
    await page.clock.resume();
    await context.setOffline(false);
    await expect(journal).toBeEditable();
    await expect(journal).toHaveValue(before);
  });
});
