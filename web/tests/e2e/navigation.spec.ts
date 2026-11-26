import { expect, test } from "./fixtures";
import { SECTION_PAGES, gotoReady, isPhone, pageHeading } from "./helpers";

test.describe("desktop sidebar", () => {
  test.beforeEach(() => test.skip(isPhone(test.info()), "desktop only"));

  test("reaches every section, marks the current one and moves focus to the heading", async ({ page }) => {
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav.getByRole("link", { name: /^Home/ })).toHaveAttribute("aria-current", "page");
    for (const s of SECTION_PAGES.slice(1)) {
      const label = s.h1;
      await nav.getByRole("link", { name: new RegExp(`^${label}`) }).click();
      await expect(page).toHaveURL(s.path);
      await expect(pageHeading(page)).toHaveText(s.h1);
      await expect(page).toHaveTitle(s.title);
      await expect(nav.getByRole("link", { name: new RegExp(`^${label}`) })).toHaveAttribute("aria-current", "page");
      await expect(pageHeading(page)).toBeFocused();
    }
    await nav.getByRole("link", { name: /^Home/ }).click();
    await expect(page).toHaveURL("/");
    await expect(pageHeading(page)).toHaveText("FDE Journey");
  });

  // Expects nothing saved yet, so it runs before the tests that save.
  test("shows a done count beside each section", { tag: "@fresh" }, async ({ page }) => {
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav.getByRole("link", { name: /^Roadmap 0 of \d+ done$/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Certifications 0 of 7 done" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Projects 0 of 3 done" })).toBeVisible();
  });

  test("offers a skip link first", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    // A full-size target, clear of the sidebar and the heading.
    const box = await skip.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.x).toBe(12);
    expect(box?.y).toBe(12);
  });
});

test.describe("phone bottom bar", () => {
  test.beforeEach(() => test.skip(!isPhone(test.info()), "phone only"));

  test("reaches Home, Roadmap, Reading and Scaler from the bar", async ({ page }) => {
    await gotoReady(page, "/");
    const bar = page.getByRole("navigation", { name: "Sections" });
    for (const [name, path, h1] of [
      ["Roadmap", "/roadmap", "Roadmap"],
      ["Reading", "/reading", "Reading"],
      ["Scaler", "/scaler", "Scaler course"],
      ["Home", "/", "FDE Journey"],
    ] as const) {
      await bar.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(pageHeading(page)).toHaveText(h1);
      await expect(bar.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    }
  });

  test("reaches Certifications, Projects and Career through More", async ({ page }) => {
    await gotoReady(page, "/");
    const bar = page.getByRole("navigation", { name: "Sections" });
    const more = bar.getByRole("button", { name: "More" });
    for (const [name, path] of [
      ["Certifications", "/certs"],
      ["Projects", "/projects"],
      ["Career", "/career"],
    ] as const) {
      await more.click();
      await expect(more).toHaveAttribute("aria-expanded", "true");
      const row = bar.getByRole("link", { name, exact: true });
      await expect(row).toBeVisible();
      await row.click();
      await expect(page).toHaveURL(path);
      await expect(pageHeading(page)).toHaveText(name);
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await expect(row).toBeHidden();
    }
  });

  test("Tab never leaves the focused control hidden under the bar", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const hidden: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const covered = await page.evaluate(() => {
        const el = document.activeElement;
        // The bar's list (the desktop sidebar is also a "Sections" nav, hidden on phones).
        const bar = [...document.querySelectorAll('nav[aria-label="Sections"] > ul')].find((ul) => ul.getBoundingClientRect().height > 0);
        if (!el || el === document.body || !bar || bar.contains(el)) return null;
        const box = el.getBoundingClientRect();
        return box.bottom > bar.getBoundingClientRect().top ? (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName) : null;
      });
      if (covered) hidden.push(covered);
    }
    expect(hidden, "focused controls under the bottom bar").toEqual([]);
  });

  test("the More sheet focuses its first row and closes with Escape or the scrim", async ({ page }) => {
    await gotoReady(page, "/reading");
    const bar = page.getByRole("navigation", { name: "Sections" });
    const more = bar.getByRole("button", { name: "More" });
    await more.click();
    await expect(bar.getByRole("link", { name: "Certifications" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toBeFocused();

    await more.click();
    await page.mouse.click(195, 100); // the scrim, above the sheet
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL("/reading");
  });
});
