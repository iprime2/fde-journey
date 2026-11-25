import { expect, test } from "@playwright/test";

test("home page loads and shows the roadmap content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("FDE Journey");
  await expect(page.getByText(/trackable items loaded/)).toBeVisible();
});
