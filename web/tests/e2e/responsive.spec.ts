// Responsive rules from design spec 3.4: gutters, the certification grid and the text measure.
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, isPhone, pageHeading } from "./helpers";

test.describe("responsive rules", () => {
  // One run is enough: these set their own sizes.
  test.beforeEach(() => test.skip(isPhone(test.info()), "sets its own screen sizes"));

  test("side gutters are 16 px on phones and 24 px from 768 px", async ({ page }) => {
    for (const [width, gutter] of [
      [390, "16px"],
      [768, "24px"],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/roadmap");
      await expect(page.locator("main#main")).toHaveCSS("padding-left", gutter);
      await expect(page.locator("main#main")).toHaveCSS("padding-right", gutter);
      await expectNoSidewaysScroll(page);
    }
  });

  test("certification cards are one column below 1280 px and two from 1280 px", async ({ page }) => {
    const headings = page.getByRole("heading", { level: 2 });
    for (const [width, columns] of [
      [768, 1],
      [1024, 1],
      [1280, 2],
      [1440, 2],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/certs");
      const [first, second] = [await headings.nth(0).boundingBox(), await headings.nth(1).boundingBox()];
      const sideBySide = Math.abs(first!.y - second!.y) < 2;
      expect(sideBySide ? 2 : 1, `${width} px`).toBe(columns);
      await expectNoSidewaysScroll(page);
    }
  });

  test("descriptions are capped at 34em, not ch", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoReady(page, "/roadmap");
    const description = pageHeading(page).locator("xpath=following-sibling::p").first();
    // 13 px text: 34em = 442 px (about 73 characters).
    await expect(description).toHaveCSS("max-width", "442px");
  });
});
