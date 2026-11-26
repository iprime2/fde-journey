// /waitlist (design spec 5): the designed page, and leaving the waitlist. Made-up users only:
// Wren Waiting (first in line, shared, read-only here) and a spare waitlisted user per screen size
// and attempt for leaving, which deletes their account (scripts/lib/e2e-data.mjs).
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, pageHeading } from "./helpers";

test.describe("the waitlist page", () => {
  test.use({ as: "waitlisted" });

  test("shows the place in line, the explanation, the account and the actions", async ({ page }) => {
    await gotoReady(page, "/waitlist");
    await expect(page).toHaveTitle("Waitlist · FDE Journey");
    await expect(pageHeading(page)).toHaveText("You're on the waitlist");
    await expect(page.getByText("Your place in line")).toBeVisible();
    await expect(page.getByText("Number 1", { exact: true })).toBeVisible();
    await expect(page.getByText("You're next.")).toBeVisible();
    await expect(page.getByText("FDE Journey has a limited number of places")).toBeVisible();
    await expect(page.getByText("We don't send email, so check back here.")).toBeVisible();
    await expect(page.getByText(/^Joined the waitlist on \d{1,2} [A-Z][a-z]{2} \d{4}\.$/)).toBeVisible();
    await expect(page.getByText("Wren Waiting")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave the waitlist" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy: what's stored and who sees it" })).toHaveAttribute("href", "/privacy");
    await expectNoSidewaysScroll(page);
  });

  test("Cancel closes the leave dialog and keeps the place", async ({ page }) => {
    await gotoReady(page, "/waitlist");
    const leave = page.getByRole("button", { name: "Leave the waitlist" });
    await leave.click();
    const dialog = page.getByRole("dialog", { name: "Leave the waitlist?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(/This deletes your account and your place in line/);
    // Destructive: focus starts on Cancel, so a stray Enter does nothing harmful.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(leave).toBeFocused();
    await expect(page).toHaveURL("/waitlist");
  });
});

test.describe("leaving the waitlist", () => {
  test.use({ as: "leaver" });

  test("deletes the account, signs out and says so on the sign-in page", async ({ page }) => {
    await gotoReady(page, "/waitlist");
    await expect(page.getByText(/(person|people) (is|are) ahead of you\.$/)).toBeVisible();
    await page.getByRole("button", { name: "Leave the waitlist" }).click();
    const dialog = page.getByRole("dialog", { name: "Leave the waitlist?" });
    await dialog.getByRole("button", { name: "Leave the waitlist" }).click();
    await expect(page).toHaveURL("/login?status=left-waitlist");
    await expect(page.getByRole("status").filter({ hasText: "You've left the waitlist and your account is deleted." })).toBeVisible();
    // Nothing left to sign back into.
    await page.goto("/waitlist");
    await expect(page).toHaveURL(/\/login/);
  });
});
