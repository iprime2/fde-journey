// /settings (design spec 5): section switches change the navigation; hidden sections are refused
// on the server; the Scaler access code; Claude export keys; Download my data; deleting the
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

  test("hidden and locked sections are refused on the server", async ({ page }) => {
    // A new user: Roadmap, Reading and Certifications on; Scaler locked.
    await gotoReady(page, "/scaler");
    await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
    await gotoReady(page, "/settings");
    const reading = page.getByRole("switch", { name: "Reading" });
    await expect(reading).toBeChecked();
    await reading.click();
    await expect(navLinks(page, "/reading")).toHaveCount(0);
    await gotoReady(page, "/reading");
    await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
    await gotoReady(page, "/settings");
    await page.getByRole("switch", { name: "Reading" }).click();
    await expect(navLinks(page, "/reading")).not.toHaveCount(0);
    await gotoReady(page, "/reading");
    await expect(pageHeading(page)).toHaveText("Reading");
  });

  test("section switches change the navigation at once", async ({ page }) => {
    await gotoReady(page, "/settings");
    await expect(page).toHaveTitle("Settings · FDE Journey");
    await expect(pageHeading(page)).toHaveText("Settings");
    await expect(page.getByText("Always on")).toBeVisible();
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

  test("the Scaler access code: a wrong code, then the right one", async ({ page }) => {
    await gotoReady(page, "/settings");
    const scaler = page.getByRole("switch", { name: "Scaler course" });
    await expect(scaler).toBeDisabled();
    const code = page.getByRole("textbox", { name: "Access code" });
    await code.fill("NOT-THE-CODE");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That code isn't right. 4 tries left this hour.")).toBeVisible();
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toBeFocused();

    await code.fill(E2E_SCALER_CODE.toLowerCase());
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Scaler course is unlocked and on." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scaler course" })).toHaveCount(0);
    await expect(scaler).toBeEnabled();
    await expect(scaler).toBeChecked();
    await expect(scaler).toBeFocused();
    await expect(navLinks(page, "/scaler")).not.toHaveCount(0);
    await gotoReady(page, "/scaler");
    await expect(pageHeading(page)).toHaveText("Scaler course");
  });

  test("a Claude export key is shown once, then listed, then revoked", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoReady(page, "/settings");
    await expect(page.getByText("No keys yet.")).toBeVisible();
    await page.getByRole("button", { name: "Create a key" }).click();
    const key = page.getByRole("textbox", { name: "Your new key" });
    await expect(key).toBeVisible();
    await expect(key).toBeFocused();
    const value = await key.inputValue();
    expect(value).toMatch(/^fdej_/);
    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Copied to the clipboard.")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(key).toHaveCount(0);

    // Shown once: after a reload the key is listed but never shown again.
    await gotoReady(page, "/settings");
    expect(await page.content()).not.toContain(value);
    await expect(page.getByText(/^Key created \d/)).toBeVisible();
    await expect(page.getByText("Never used")).toBeVisible();

    await page.getByRole("button", { name: /^Revoke the key created/ }).click();
    const dialog = page.getByRole("dialog", { name: "Revoke this key?" });
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
