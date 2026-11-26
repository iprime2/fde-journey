// /settings (design spec 5): section switches change the navigation; a section the user hid opens
// with a banner, a locked Scaler is not found; the Scaler access code; Claude export keys; Download my data; deleting the
// account. Each screen size and each attempt uses its own made-up spare user (tests/e2e/auth.ts,
// PER_PROJECT_USERS), so nothing here touches the shared users and a retry starts fresh.
import type { Page } from "@playwright/test";
import { E2E_SCALER_CODE, e2eSpareUser } from "../../scripts/lib/e2e-data.mjs";
import { screenOf } from "./auth";
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, pageHeading } from "./helpers";

const NOT_FOUND = "This page doesn't exist.";

/** Links to a section in the navigation (the sidebar and the bottom bar or More sheet render the same choices). */
const navLinks = (page: Page, href: string) => page.locator(`nav[aria-label="Sections"] a[href="${href}"]`);

test.describe("settings", () => {
  test.use({ as: "settings" });
  test.describe.configure({ mode: "serial" });

  test("a section hidden by the user opens with a banner; a locked Scaler is not found", async ({ page }, testInfo) => {
    // A new user: Roadmap, Reading and Certifications on; Scaler locked (no access code).
    await gotoReady(page, "/scaler");
    await expect(page.getByRole("heading", { level: 1, name: NOT_FOUND })).toBeVisible();
    await expect(page).toHaveTitle("Page not found · FDE Journey");
    // In the app frame: one <main>, no second lockup, the card at the top-left of the column.
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByText("FDE Journey", { exact: true }).filter({ visible: true })).toHaveCount(testInfo.project.name.startsWith("phone") ? 0 : 1);

    await gotoReady(page, "/settings");
    const reading = page.getByRole("switch", { name: "Reading" });
    await expect(reading).toBeChecked();
    await reading.click();
    await expect(navLinks(page, "/reading")).toHaveCount(0);

    await gotoReady(page, "/reading");
    await expect(pageHeading(page)).toHaveText("Reading");
    const banner = page.getByRole("status").filter({ hasText: "You've hidden Reading from your menu." });
    await expect(banner).toBeVisible();
    // Under the header, above the toolbar.
    const search = page.getByRole("searchbox", { name: "Search this page" });
    expect((await banner.boundingBox())!.y).toBeLessThan((await search.boundingBox())!.y);
    // The page works as usual, and no navigation item is current.
    await expect(page.getByRole("checkbox").first()).toBeEnabled();
    await expect(page.locator('nav[aria-label="Sections"] [aria-current="page"]')).toHaveCount(0);

    await banner.getByRole("link", { name: "Turn it back on in Settings" }).click();
    await expect(page).toHaveURL("/settings");
    await page.getByRole("switch", { name: "Reading" }).click();
    await expect(navLinks(page, "/reading")).not.toHaveCount(0);
    await gotoReady(page, "/reading");
    await expect(page.getByText("You've hidden Reading from your menu.")).toHaveCount(0);
  });

  test("section switches change the navigation at once", async ({ page }) => {
    await gotoReady(page, "/settings");
    await expect(page).toHaveTitle("Settings · FDE Journey");
    await expect(pageHeading(page)).toHaveText("Settings");
    // Roadmap and Courses & badges can't be switched off: "Always on", no switch.
    await expect(page.getByText("Always on")).toHaveCount(2);
    const coursesRow = page.locator("li", { hasText: "Courses & badges" });
    await expect(coursesRow).toContainText("Courses from OpenAI and Anthropic, by roadmap phase.");
    await expect(coursesRow.getByText("Always on")).toBeVisible();
    await expect(coursesRow.getByRole("switch")).toHaveCount(0);
    await expect(page.getByRole("switch", { name: /Courses/ })).toHaveCount(0);
    // Between Certifications and Projects.
    const rowNames = await page.locator("section", { has: page.getByRole("heading", { name: "Sections" }) }).locator("li .type-body-strong").allTextContents();
    expect(rowNames.slice(rowNames.indexOf("Certifications"), rowNames.indexOf("Certifications") + 3)).toEqual(["Certifications", "Courses & badges", "Projects"]);
    await expect(navLinks(page, "/settings")).not.toHaveCount(0);
    // Not an admin: no Admin link.
    await expect(page.locator('nav[aria-label="Sections"] a[href^="/admin"]')).toHaveCount(0);

    const projects = page.getByRole("switch", { name: "Projects" });
    await expect(projects).not.toBeChecked();
    await expect(projects).toHaveAccessibleDescription("Three portfolio projects, step by step.");
    await expect(navLinks(page, "/projects")).toHaveCount(0);
    // Space toggles it, like any checkbox.
    await projects.focus();
    await page.keyboard.press("Space");
    await expect(projects).toBeChecked();
    await expect(navLinks(page, "/projects")).not.toHaveCount(0);
    await gotoReady(page, "/settings");
    await expect(page.getByRole("switch", { name: "Projects" })).toBeChecked();
    await page.getByRole("switch", { name: "Projects" }).click();
    await expect(navLinks(page, "/projects")).toHaveCount(0);
    await expectNoSidewaysScroll(page);
  });

  test("the Scaler access code: a wrong code, then the right one", async ({ page }, testInfo) => {
    const DBG: string[] = [];
    const t0 = Date.now();
    const at = () => `${String(Date.now() - t0).padStart(6)}ms`;
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) DBG.push(`${at()} NAV ${f.url()}`); });
    page.on("request", (r) => { if (!r.url().includes("/_next/static") && !r.url().includes("avatars")) DBG.push(`${at()} REQ ${r.method()} ${r.url()} ${r.headers()["next-action"] ? "[action " + r.headers()["next-action"].slice(0, 8) + "]" : ""}${r.headers()["next-router-prefetch"] ? "[prefetch]" : ""}${r.headers()["rsc"] ? "[rsc]" : ""}`); });
    page.on("response", (r) => { if (!r.url().includes("/_next/static") && !r.url().includes("avatars")) DBG.push(`${at()} RES ${r.status()} ${r.url()} ${r.request().headers()["next-action"] ? "[action " + r.request().headers()["next-action"].slice(0, 8) + "]" : ""} setcookie=${r.headers()["set-cookie"] ? "yes" : ""}`); });
    await page.exposeBinding("__dbgFocus", (_s, what: string) => DBG.push(`${at()} FOCUS ${what}`));
    await page.addInitScript(() => {
      document.addEventListener("focusout", (e) => (window as unknown as { __dbgFocus: (s: string) => void }).__dbgFocus(`out ${(e.target as HTMLElement).getAttribute("role") ?? (e.target as HTMLElement).tagName} -> ${(e.relatedTarget as HTMLElement | null)?.tagName ?? "null"}`), true);
      document.addEventListener("focusin", (e) => (window as unknown as { __dbgFocus: (s: string) => void }).__dbgFocus(`in ${(e.target as HTMLElement).getAttribute("role") ?? (e.target as HTMLElement).tagName}`), true);
    });
    try {
    await gotoReady(page, "/settings");
    DBG.push(`${at()} --- loaded`);
    const scaler = page.getByRole("switch", { name: "Scaler course" });
    // Locked by code: no switch, "Locked" and what to do instead.
    await expect(scaler).toHaveCount(0);
    await expect(page.getByText("Locked", { exact: true })).toBeVisible();
    await expect(page.getByText("Enter your access code below to unlock it.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Unlock Scaler course" })).toBeVisible();
    const code = page.getByRole("textbox", { name: "Access code" });
    await code.fill("NOT-THE-CODE");
    DBG.push(`${at()} --- unlock wrong`);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That code isn't right. 4 tries left this hour.")).toBeVisible();
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toBeFocused();

    await code.fill(E2E_SCALER_CODE.toLowerCase());
    DBG.push(`${at()} --- unlock right`);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Scaler course is unlocked and on." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Unlock Scaler course" })).toHaveCount(0);
    await expect(page.getByText("Locked", { exact: true })).toHaveCount(0);
    await expect(scaler).toBeEnabled();
    await expect(scaler).toBeChecked();
    await expect(scaler).toBeFocused();
    await expect(navLinks(page, "/scaler")).not.toHaveCount(0);
    await gotoReady(page, "/scaler");
    await expect(pageHeading(page)).toHaveText("Scaler course");
    } catch (e) { console.log(`DEBUG-DUMP-SETTINGS ${testInfo.project.name}\n${DBG.join("\n")}`); throw e; }
  });

  test("a Claude export key is shown once, then listed, then revoked", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoReady(page, "/settings");
    await expect(page.getByText("No keys yet.")).toBeVisible();
    // The export address, with its own Copy.
    await expect(page.getByText("Export address", { exact: true })).toBeVisible();
    await expect(page.getByText(/^https?:\/\/[^ ]+\/api\/export$/)).toBeVisible();
    await page.getByRole("button", { name: "Copy the export address" }).click();
    await expect(page.getByRole("button", { name: "Copy the export address" })).toHaveText("Copied");
    await page.getByRole("button", { name: "Create a key" }).click();
    const key = page.getByRole("textbox", { name: "Your new key" });
    await expect(key).toBeVisible();
    await expect(key).toBeFocused();
    const value = await key.inputValue();
    expect(value).toMatch(/^fdej_/);
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByText("Copied to the clipboard.")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(key).toHaveCount(0);

    // Shown once: after a reload the key is listed but never shown again.
    await gotoReady(page, "/settings");
    expect(await page.content()).not.toContain(value);
    // With the time, so two keys made the same day can be told apart.
    await expect(page.getByText(/^Key created \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} IST$/)).toBeVisible();
    await expect(page.getByText("Never used")).toBeVisible();

    await page.getByRole("button", { name: /^Revoke the key created \d.+, \d{2}:\d{2} IST$/ }).click();
    const dialog = page.getByRole("dialog", { name: "Revoke this key?" });
    await expect(dialog).toHaveAccessibleDescription(/^The key created \d.+, \d{2}:\d{2} IST stops working at once/);
    await dialog.getByRole("button", { name: "Revoke" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Key revoked." })).toBeVisible();
    await expect(page.getByText("No keys yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Claude export keys" })).toBeFocused();
  });

  test("Download my data saves a JSON file of the user's own data", async ({ page }) => {
    await gotoReady(page, "/settings");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^fde-journey-data-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const data = JSON.parse(readFileSync(path, "utf8")) as { format: string; profile: { githubLogin: string } };
    expect(data.format).toBe("fde-journey-data");
    expect(["sky-settings", "sol-settings"]).toContain(data.profile.githubLogin);
  });
});

test.describe("the owner's settings", () => {
  test("the owner's account can't be deleted here", async ({ page }) => {
    await gotoReady(page, "/settings");
    await expect(page.getByText("The owner's account can't be deleted here.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
    // The owner always has Scaler: no access-code card.
    await expect(page.getByRole("textbox", { name: "Access code" })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Scaler course" })).toBeEnabled();
  });
});

test.describe("deleting an account", () => {
  test.use({ as: "deleter" });

  test("asks for the GitHub username, then deletes and signs out", async ({ page }, testInfo) => {
    const username = e2eSpareUser("deleter", screenOf(testInfo.project.name), testInfo.retry).login;
    await gotoReady(page, "/settings");
    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    const field = dialog.getByRole("textbox", { name: `To confirm, type your GitHub username: ${username}` });
    await expect(field).toBeFocused();
    const confirm = dialog.getByRole("button", { name: "Delete my account" });
    await confirm.click();
    await expect(dialog.getByText("Type your GitHub username to confirm.")).toBeVisible();
    await field.fill("someone-else");
    await field.press("Enter");
    await expect(dialog.getByText(`That doesn't match your username. Type ${username}.`)).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeFocused();

    await field.fill(` ${username.toUpperCase()} `);
    await confirm.click();
    await expect(page).toHaveURL("/login?status=deleted");
    await expect(page.getByRole("status").filter({ hasText: "Your account and data are deleted." })).toBeVisible();
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
