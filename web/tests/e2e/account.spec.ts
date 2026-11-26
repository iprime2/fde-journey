// Who is signed in, and Sign out (design spec 4, Avatar and AccountMenu): the account menu at the
// foot of the desktop sidebar, and the account row in the phone More sheet. Signing out for real
// is covered in session.spec.ts ("signing out"), through these same controls.
import type { Locator, Page, Request } from "@playwright/test";
import { AVATAR_ORIGIN, AVATAR_ROUTE } from "./avatar";
import { expect, test } from "./fixtures";
import { E2E_OWNER_NAME, gotoReady, isPhone, pageHeading } from "./helpers";

/**
 * The seeded owner has a made-up GitHub avatar URL, which the fixtures answer with a solid-colour
 * PNG: the avatar shows that image, sized for 32 px at 2x, with no referrer.
 */
async function expectPhoto(scope: Locator) {
  const avatar = scope.locator("[data-avatar]");
  await expect(avatar).toHaveAttribute("data-avatar", "photo");
  await expect(avatar).toHaveAttribute("aria-hidden", "true");
  const img = avatar.locator("img");
  await expect(img).toHaveAttribute("src", /^https:\/\/avatars\.githubusercontent\.com\/u\/0\?v=4&s=64$/);
  await expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(img).toHaveAttribute("alt", "");
  // Loaded, not just present.
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(64);
}

/** Without a photo (it failed to load), the initials show and the <img> is gone. */
async function expectInitials(scope: Locator) {
  const avatar = scope.locator("[data-avatar]");
  await expect(avatar).toHaveAttribute("data-avatar", "initials");
  await expect(avatar).toHaveText("SE");
  await expect(avatar).toBeVisible();
  await expect(avatar.locator("img")).toHaveCount(0);
}

/** Collects the browser's requests for the avatar, with the headers it really sent. */
function recordAvatarRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith(AVATAR_ORIGIN)) requests.push(r);
  });
  return requests;
}

/**
 * Holds the next sign-out request (a Server Action POST) until `release` is called, so the
 * "Signing out…" state can be checked, as login.spec.ts does for sign-in.
 */
async function holdSignOut(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) await held;
    await route.fallback();
  });
  return release;
}

/** Design spec 4, Button loading: label, disabled, busy, full opacity, progress cursor. */
async function expectSigningOut(button: Locator) {
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toHaveCSS("opacity", "1");
  await expect(button).toHaveCSS("cursor", "progress");
}

test.describe("desktop account menu", () => {
  test.beforeEach(() => test.skip(isPhone(test.info()), "desktop only"));

  test("opens to show who is signed in, and Escape closes it with focus back on the button", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const account = page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` });
    await expect(account).toBeVisible();
    await expect(account).toHaveAttribute("aria-expanded", "false");
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
    // The panel opens above the button, clear of the divider above it (8 px padding, 1 px line).
    const panelBox = await panel.boundingBox();
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(box!.y - 16);

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
    await expect(signOut).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(account).toBeFocused();
    await expect(signOut).toBeVisible();

    // A click outside closes it.
    await pageHeading(page).click();
    await expect(signOut).toBeHidden();
  });
});

test.describe("desktop account avatar", () => {
  test.beforeEach(() => test.skip(isPhone(test.info()), "desktop only"));

  test("shows the GitHub photo, sized for 2x screens and sent without a referrer", async ({ page }) => {
    const requests = recordAvatarRequests(page);
    await gotoReady(page, "/roadmap");
    await expectPhoto(page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` }));
    expect(requests.length, "the avatar was requested (and answered by the test)").toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.url()).toBe(`${AVATAR_ORIGIN}/u/0?v=4&s=64`);
      expect(await request.allHeaders()).not.toHaveProperty("referer");
    }
  });

  test.describe("when the photo fails to load", () => {
    test.use({ allowedConsoleErrors: [/Failed to load resource/] });

    test("falls back to the initials", async ({ page }) => {
      await page.route(AVATAR_ROUTE, (route) => route.fulfill({ status: 404, body: "" }));
      await gotoReady(page, "/roadmap");
      await expectInitials(page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` }));
    });
  });
});

test.describe("signing out from the account controls", () => {
  // Signs out for real once the held request goes on, so it ends a spare session of its own.
  test.use({ session: "signing-out" });

  test('shows "Signing out…" while the request is on its way', async ({ page }, testInfo) => {
    await gotoReady(page, "/roadmap");
    if (isPhone(testInfo)) {
      await page.getByRole("button", { name: "More" }).click();
    } else {
      await page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` }).click();
    }
    const release = await holdSignOut(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    const busy = page.getByRole("button", { name: "Signing out…" });
    await expectSigningOut(busy);
    release();
    await expect(page).toHaveURL("/login?status=signed-out");
    await expect(page.getByRole("status").filter({ hasText: "You're signed out." })).toBeVisible();
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
    await expectPhoto(nav);
    expect((await signOut.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // Focus order (design spec 3.5): Certifications, Projects, Career, Settings, Admin, Sign out.
    await expect(nav.getByRole("link", { name: "Certifications" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Projects" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Career" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Admin" })).toBeFocused();
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
