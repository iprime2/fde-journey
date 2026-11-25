import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers";

test.describe("open and close, remembered on the device", () => {
  test("Scaler: the current module starts open; other modules open and stay open", async ({ page }) => {
    await gotoReady(page, "/scaler");
    const firstClass = page.getByRole("checkbox", { name: "Mark done: Your Playbook for Every Client Room" });
    const moduleTwoClass = page.getByRole("checkbox", { name: "Mark done: Your Workbench - Python Toolchain Done Right" });
    await expect(firstClass).toBeVisible();
    await expect(moduleTwoClass).toBeHidden();

    await page.locator("summary", { hasText: "Module 2 · The Ingestion Pipeline" }).click();
    await expect(moduleTwoClass).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fde-open-modules"))).toBe("[1,2]");

    await page.locator("summary", { hasText: "Module 1 · The FDE Launchpad" }).click();
    await expect(firstClass).toBeHidden();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fde-open-modules"))).toBe("[2]");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(moduleTwoClass).toBeVisible();
    await expect(firstClass).toBeHidden();
  });

  test("Scaler: modules open from the keyboard", async ({ page }) => {
    await gotoReady(page, "/scaler");
    const summary = page.locator("summary", { hasText: "Module 3 · The Platform's Backend" });
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: "Mark done: Your First Production API" })).toBeVisible();
  });

  test("Roadmap: a resource list opens, shows its resources and stays open", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const resource = page.getByRole("link", { name: /CS50P Lectures 0–2/ });
    await expect(resource).toBeHidden();
    await page.locator("summary", { hasText: "Learning resources" }).first().click();
    await expect(resource).toBeVisible();
    await expect(resource).toHaveAttribute("target", "_blank");
    await expect(page.getByText(/^Start here:/).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fde-open-res"))).toBe('["l1-1"]');

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(resource).toBeVisible();
  });
});
