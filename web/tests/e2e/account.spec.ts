// Who is signed in, and Sign out (design spec 4, Avatar and AccountMenu): the account menu at the
// foot of the desktop sidebar, and the account row in the phone More sheet. Signing out for real
// is covered in session.spec.ts ("signing out"), through these same controls.
import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";
import { E2E_OWNER_NAME, gotoReady, isPhone, pageHeading } from "./helpers";

/** The seeded owner has no image, so the avatar shows initials and no photo. */
async function expectInitials(scope: Locator) {
  const avatar = scope.locator("[data-avatar]");
  await expect(avatar).toHaveAttribute("data-avatar", "initials");
  await expect(avatar).toHaveText("SE");
  await expect(avatar).toHaveAttribute("aria-hidden", "true");
  await expect(avatar.locator("img")).toHaveCount(0);
}

test.describe("desktop account menu", () => {
  test.beforeEach(() => test.skip(isPhone(test.info()), "desktop only"));

  test("opens to show who is signed in, and Escape closes it with focus back on the button", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const account = page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` });
    await expect(account).toBeVisible();
    await expect(account).toHaveAttribute("aria-expanded", "false");
    await expectInitials(account);
    // Inside the 248 px sidebar.
    const box = await account.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(248);
    expect(box!.height).toBeGreaterThanOrEqual(52);

    await account.click();
    await expect(account).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`[id="${await account.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Signed in with GitHub as")).toBeVisible();
    await expect(panel.getByText(E2E_OWNER_NAME, { exact: true })).toBeVisible();
    const signOut = panel.getByRole("button", { name: "Sign out" });
    await expect(signOut).toBeFocused();
    // The panel opens above the button.
    const panelBox = await panel.boundingBox();
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(box!.y);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(account).toHaveAttribute("aria-expanded", "false");
    await expect(account).toBeFocused();
  });

  test("closes when focus or a click goes elsewhere", async ({ page }) => {
    await gotoReady(page, "/");
    const account = page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` });
    const signOut = page.getByRole("button", { name: "Sign out" });

    // Keyboard: Enter opens it; Tab from Sign out leaves the panel and closes it.
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(signOut).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(signOut).toBeHidden();
    await expect(account).toHaveAttribute("aria-expanded", "false");

    // Shift+Tab from Sign out goes back to the account button and keeps the panel open.
    await account.click();
    await page.keyboard.press("Shift+Tab");
    await expect(account).toBeFocused();
    await expect(signOut).toBeVisible();

    // A click outside closes it.
    await pageHeading(page).click();
    await expect(signOut).toBeHidden();
  });
});

test.describe("phone More sheet", () => {
  test.beforeEach(() => test.skip(!isPhone(test.info()), "phone only"));

  test("ends with an account row: name, how they signed in, and Sign out", async ({ page }) => {
    await gotoReady(page, "/reading");
    const nav = page.getByRole("navigation", { name: "Sections" });
    const more = nav.getByRole("button", { name: "More" });
    const signOut = nav.getByRole("button", { name: "Sign out" });
    await expect(signOut).toBeHidden();

    await more.click();
    await expect(nav.getByText(E2E_OWNER_NAME, { exact: true })).toBeVisible();
    await expect(nav.getByText("Signed in with GitHub", { exact: true })).toBeVisible();
    await expect(signOut).toBeVisible();
    // The sheet's only avatar is the account row's.
    await expectInitials(nav);
    expect((await signOut.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // Focus order: Certifications, Projects, Career, Sign out.
    await expect(nav.getByRole("link", { name: "Certifications" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Projects" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Career" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(signOut).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(signOut).toBeHidden();
    await expect(more).toBeFocused();
  });

  test("on a short landscape screen the bar is 48 px, and the sheet opens above it", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoReady(page, "/roadmap");
    const nav = page.getByRole("navigation", { name: "Sections" });
    const bar = nav.locator(":scope > ul");
    expect((await bar.boundingBox())!.height).toBe(48);
    // Icon beside the label: the cell is wider than tall.
    const cell = (await nav.getByRole("link", { name: "Roadmap", exact: true }).boundingBox())!;
    expect(cell.height).toBeGreaterThanOrEqual(48);
    await expect(nav.getByRole("link", { name: "Roadmap", exact: true })).toHaveCSS("flex-direction", "row");

    await nav.getByRole("button", { name: "More" }).click();
    const signOut = nav.getByRole("button", { name: "Sign out" });
    await expect(signOut).toBeVisible();
    const sheetBottom = (await signOut.boundingBox())!;
    expect(sheetBottom.y + sheetBottom.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
    const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
