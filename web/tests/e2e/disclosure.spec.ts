import { expect, test } from "./fixtures";
import { gotoReady } from "./helpers";

test.describe("open and close, remembered on the device", () => {
  test("Scaler: the current module starts open; other modules open and stay open", async ({ page }) => {
    await gotoReady(page, "/scaler");
    const firstClass = page.getByRole("checkbox", { name: "Mark done: Your Playbook for Every Client Room" });
    const moduleTwoClass = page.getByRole("checkbox", { name: "Mark done: Your Workbench - Python Toolchain Done Right" });
    await expect(firstClass).toBeVisible();
    await expect(moduleTwoClass).toBeHidden();

    const moduleOne = page.getByRole("button", { name: "Module 1 · The FDE Launchpad" });
    const moduleTwo = page.getByRole("button", { name: "Module 2 · The Ingestion Pipeline" });
    await expect(moduleOne).toHaveAttribute("aria-expanded", "true");
    await expect(moduleTwo).toHaveAttribute("aria-expanded", "false");
    // The heading holds the button, so screen-reader users can jump between modules by heading.
    await expect(page.getByRole("heading", { level: 2, name: "Module 2 · The Ingestion Pipeline" })).toBeVisible();

    await moduleTwo.click();
    await expect(moduleTwo).toHaveAttribute("aria-expanded", "true");
    await expect(moduleTwoClass).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fde-open-modules"))).toBe("[1,2]");

    await moduleOne.click();
    await expect(moduleOne).toHaveAttribute("aria-expanded", "false");
    await expect(firstClass).toBeHidden();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fde-open-modules"))).toBe("[2]");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(moduleTwoClass).toBeVisible();
    await expect(firstClass).toBeHidden();
  });

  test("Scaler: modules open from the keyboard", async ({ page }) => {
    await gotoReady(page, "/scaler");
    const button = page.getByRole("button", { name: "Module 3 · The Platform's Backend" });
    const firstClass = page.getByRole("checkbox", { name: "Mark done: Your First Production API" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(firstClass).toBeVisible();
    await page.keyboard.press("Space");
    await expect(firstClass).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("Scaler: the whole card head opens the module", async ({ page }) => {
    await gotoReady(page, "/scaler");
    // Tap the sub line, not the title. The button's ::after covers the head, so the tap reaches
    // the button (Playwright's own click refuses here for exactly that reason).
    const card = page.getByRole("region", { name: "Module 2 · The Ingestion Pipeline" });
    const subLine = card.getByText(/^Production Python · 1\.25 mo · \d+ classes$/);
    await subLine.scrollIntoViewIfNeeded(); // page.mouse only reaches what is on screen
    const sub = await subLine.boundingBox();
    expect(sub).not.toBeNull();
    await page.mouse.click(sub!.x + sub!.width / 2, sub!.y + sub!.height / 2);
    await expect(page.getByRole("button", { name: "Module 2 · The Ingestion Pipeline" })).toHaveAttribute("aria-expanded", "true");
  });

  test("Roadmap: a resource list opens, shows its resources and stays open", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const resource = page.getByRole("link", { name: /CS50P Lectures 0–2/ });
    await expect(resource).toBeHidden();
    const toggle = page.getByRole("button", { name: /^Learning resources/ }).first();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(resource).toBeVisible();
    await expect(resource).toHaveAttribute("target", "_blank");
    await expect(page.getByText(/^Start here:/).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fde-open-res"))).toBe('["l1-1"]');

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(resource).toBeVisible();
  });
});
