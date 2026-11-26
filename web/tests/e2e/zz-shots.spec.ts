// TEMPORARY: screenshots for the M4b fix round. Not committed.
import type { Page, TestInfo } from "@playwright/test";
import { E2E_SHARED_LOGIN } from "../../scripts/lib/e2e-data.mjs";
import { expect, test } from "./fixtures";
import { gotoReady, isPhone } from "./helpers";

const DIR = "/tmp/claude-0/-home-user-fde-journey/954533f7-761b-54eb-8165-9701ddaa30d9/scratchpad/m4b-fix";

async function shoot(page: Page, testInfo: TestInfo, name: string, fullPage = true) {
  const width = isPhone(testInfo) ? 390 : 1280;
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${DIR}/${name}-${width}-${scheme}.png`, fullPage, animations: "disabled" });
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, `${name} ${width} ${scheme} sideways`).toBeLessThanOrEqual(iw);
  }
}

test.describe("signed out", () => {
  test.use({ signedIn: false });
  test("privacy", async ({ page }, testInfo) => {
    await gotoReady(page, "/privacy");
    await shoot(page, testInfo, "privacy");
  });
});

test.describe("active user", () => {
  test.use({ as: "active" });
  test("settings, not found, revoke dialog", async ({ page }, testInfo) => {
    await gotoReady(page, "/settings");
    await shoot(page, testInfo, "settings-locked-scaler");
    await page.getByRole("button", { name: /^Revoke the key created/ }).click();
    await shoot(page, testInfo, "settings-revoke-dialog", false);
    await page.keyboard.press("Escape");
    await gotoReady(page, "/scaler");
    await expect(page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
    await shoot(page, testInfo, "not-found-in-app");
  });
});

test.describe("hidden section", () => {
  test.use({ as: "settings" });
  test("reading hidden", async ({ page }, testInfo) => {
    await gotoReady(page, "/settings");
    await page.getByRole("switch", { name: "Reading" }).click();
    await expect(page.locator('nav[aria-label="Sections"] a[href="/reading"]')).toHaveCount(0);
    await gotoReady(page, "/reading");
    await expect(page.getByText("You've hidden Reading from your menu.")).toBeVisible();
    await shoot(page, testInfo, "hidden-reading", false);
    await gotoReady(page, "/settings");
    await page.getByRole("switch", { name: "Reading" }).click();
  });
});

test.describe("owner", () => {
  test("admin", async ({ page }, testInfo) => {
    await gotoReady(page, "/admin/admins");
    await page.getByRole("textbox", { name: "GitHub username" }).fill(E2E_SHARED_LOGIN);
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.getByRole("button", { name: /^Choose / }).first()).toBeVisible();
    await shoot(page, testInfo, "admins-chooser");
    await page.getByRole("button", { name: /^Choose / }).first().click();
    await shoot(page, testInfo, "admins-chosen");
    await gotoReady(page, "/admin/waitlist");
    await shoot(page, testInfo, "admin-waitlist");
    await gotoReady(page, "/admin/audit");
    await shoot(page, testInfo, "admin-audit");
    await gotoReady(page, "/admin/sign-up");
    await shoot(page, testInfo, "admin-sign-up");
  });
});
