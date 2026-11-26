// The sign-in page (design spec 5, /login): layout at every size, the access line, the loading
// state, reduced motion and the app icons. Signed out throughout.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { SIGN_IN_BUTTON, expectNoSidewaysScroll, gotoReady, isPhone, pageHeading } from "./helpers";

const ACCESS_LINE = "Private for now: only the owner's GitHub account can sign in.";
const POINT = "A note and a link on every step";
const TAGLINE = "From AI engineer to Forward Deployed Engineer, one milestone at a time.";

test.use({ signedIn: false });

const signInButton = (page: Page) => page.getByRole("button", { name: SIGN_IN_BUTTON });

test.describe("sign-in page layout", () => {
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
    [844, 390],
  ] as const) {
    test(`fits ${width}x${height} without sideways scrolling, with the button on screen`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await gotoReady(page, "/login");
      await expect(pageHeading(page)).toHaveText("Sign in");
      await expectNoSidewaysScroll(page);
      // Even on a short landscape phone the button is fully visible without scrolling.
      await expect(signInButton(page)).toBeInViewport({ ratio: 1 });
    });
  }

  test("from 1024 px a brand panel sits beside the card; below it, a compact header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, "/login");
    await expect(page.getByText(POINT)).toBeVisible();
    await expect(page.getByText(TAGLINE)).toBeVisible();
    const card = await pageHeading(page).boundingBox();
    expect(card!.x, "card on the right half").toBeGreaterThan(640);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(POINT)).toBeHidden();
    await expect(page.getByText(TAGLINE)).toBeVisible();
    // The lockup comes first, above the card.
    const lockup = await page.getByText("FDE Journey", { exact: true }).boundingBox();
    const heading = await pageHeading(page).boundingBox();
    expect(lockup!.y).toBeLessThan(heading!.y);

    // Short landscape: the tagline goes, so the button sits higher.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByText(TAGLINE)).toBeHidden();
  });

  test("the example path is decoration only: hidden from screen readers", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, "/login");
    const figure = page.locator("figure");
    await expect(figure).toBeVisible();
    await expect(figure).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("figure")).toHaveCount(0);
    await expect(page.getByText("Example path")).toBeVisible();
  });

  test("the button is described by the access line, and is the only control", async ({ page }) => {
    await gotoReady(page, "/login");
    await expect(page.getByText(ACCESS_LINE)).toBeVisible();
    await expect(signInButton(page)).toHaveAccessibleDescription(ACCESS_LINE);
    await page.keyboard.press("Tab");
    await expect(signInButton(page)).toBeFocused();
    await expect(page.getByRole("link")).toHaveCount(0);
  });
});

test.describe("signing in", () => {
  for (const motion of ["no-preference", "reduce"] as const) {
    test(`shows "Opening GitHub…" at full opacity while the request is on its way (${motion} motion)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await gotoReady(page, "/login");
      // Hold the sign-in request, so the loading state can be seen.
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/login*", async (route) => {
        if (route.request().method() === "POST" && route.request().headers()["next-action"]) await held;
        await route.continue();
      });
      await signInButton(page).click();
      const busy = page.getByRole("button", { name: "Opening GitHub…" });
      await expect(busy).toBeDisabled();
      await expect(busy).toHaveAttribute("aria-busy", "true");
      await expect(busy).toHaveCSS("opacity", "1");
      await expect(busy).toHaveCSS("cursor", "progress");
      // A spinner replaces the GitHub mark, unless motion is reduced (then the label alone says it).
      const spinner = busy.locator("span.rounded-full");
      const mark = busy.locator("svg");
      if (motion === "reduce") {
        await expect(spinner).toBeHidden();
        await expect(mark).toBeVisible();
      } else {
        await expect(spinner).toBeVisible();
        await expect(mark).toBeHidden();
      }
      release();
      // The test server has no GitHub app, so it comes back with "Sign-in didn't finish."
      await expect(page.getByRole("alert").filter({ hasText: "Sign-in didn't finish. Try again." })).toBeVisible();
      await expect(signInButton(page)).toBeEnabled();
    });
  }

  test("the example path is drawn in full with reduced motion", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo), "the panel shows from 1024 px");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, "/login");
    const walked = page.locator("figure path.path-draw");
    await expect(walked).toHaveCSS("animation-name", "none");
    await expect(walked).toHaveCSS("stroke-dashoffset", "0px");
  });
});

test.describe("app icons", () => {
  test("the favicon, SVG icon and home-screen icon load without signing in", async ({ page, request }) => {
    await gotoReady(page, "/login");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')].map((l) => [
        l.rel,
        l.getAttribute("href") ?? "",
        l.type,
      ]),
    );
    expect(hrefs.map(([rel, href]) => `${rel} ${href.split("?")[0]}`).sort()).toEqual([
      "apple-touch-icon /apple-icon.png",
      "icon /favicon.ico",
      "icon /icon.svg",
    ]);
    for (const [, href, type] of hrefs) {
      const res = await request.get(href, { maxRedirects: 0 });
      expect(res.status(), href).toBe(200);
      expect(res.headers()["content-type"], href).toContain(type);
    }
  });
});
