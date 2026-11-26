// /admin (design spec 5): tabs per permission, and the admin actions. Made-up people only. The
// actions use spare people, one per screen size and attempt (scripts/lib/e2e-data.mjs,
// E2E_TARGETS), so a retry never meets someone already let in or removed, and they keep the shared
// state stable: Wren Waiting stays first in line, and the cap keeps free places.
import type { Page, TestInfo } from "@playwright/test";
import { e2eTarget } from "../../scripts/lib/e2e-data.mjs";
import { screenOf } from "./auth";
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, isPhone, pageHeading } from "./helpers";

const NOT_FOUND = "This page doesn't exist.";
const ALL_TABS = ["Overview", "Users", "Waitlist", "Sign-up", "Admins", "Audit log"];
const PRIVACY_LINE = "Counts and dates only. Notes, links, Weekly notes and email addresses are never shown here.";

const tabs = (page: Page) => page.getByRole("navigation", { name: "Admin pages" }).getByRole("link");
const adminNavLinks = (page: Page) => page.locator('nav[aria-label="Sections"] a[href^="/admin"]');

/** This run's made-up target for an action ("letin", "remove", "suspend"): its screen size and attempt. */
const target = (testInfo: TestInfo, role: "letin" | "remove" | "suspend"): { name: string; login: string } =>
  e2eTarget(role, screenOf(testInfo.project.name), testInfo.retry);

test.describe("admin tabs per permission", () => {
  test("the owner sees all six tabs and every page", async ({ page }) => {
    await gotoReady(page, "/admin");
    await expect(page).toHaveTitle("Overview · Admin · FDE Journey");
    await expect(pageHeading(page)).toHaveText("Overview");
    await expect(page.getByText(PRIVACY_LINE)).toBeVisible();
    await expect(tabs(page)).toHaveText([...ALL_TABS.slice(0, 2), /^Waitlist\d+/, ...ALL_TABS.slice(3)]);
    await expect(tabs(page).first()).toHaveAttribute("aria-current", "page");
    await expect(adminNavLinks(page).first()).toHaveAttribute("href", "/admin");
    await expect(page.getByText(/places taken · \d+ free/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign-ups per week" })).toBeVisible();
    for (const [name, h1] of [
      ["Users", "Users"],
      ["Sign-up", "Sign-up"],
      ["Admins", "Admins"],
      ["Audit log", "Audit log"],
    ] as const) {
      await tabs(page).filter({ hasText: name }).click();
      await expect(pageHeading(page)).toHaveText(h1);
      await expect(tabs(page).filter({ hasText: name })).toHaveAttribute("aria-current", "page");
      await expectNoSidewaysScroll(page);
    }
  });

  test.describe("an admin with some permissions", () => {
    test.use({ as: "admin" });

    test("sees only their tabs; the others are not found", async ({ page }) => {
      await gotoReady(page, "/admin");
      await expect(tabs(page)).toHaveText(["Overview", "Users", "Audit log"]);
      await expect(adminNavLinks(page)).not.toHaveCount(0);
      // users.view without users.manage: no actions.
      await gotoReady(page, "/admin/users");
      await expect(pageHeading(page)).toHaveText("Users");
      await expect(page.getByRole("button", { name: /^Suspend / })).toHaveCount(0);
      for (const path of ["/admin/waitlist", "/admin/sign-up", "/admin/admins"]) {
        await gotoReady(page, path);
        await expect(page.getByRole("heading", { name: NOT_FOUND }), path).toBeVisible();
      }
    });
  });

  test.describe("a user who isn't an admin", () => {
    test.use({ as: "active" });

    test("has no Admin link, and the admin pages are not found", async ({ page }) => {
      await gotoReady(page, "/");
      await expect(adminNavLinks(page)).toHaveCount(0);
      for (const path of ["/admin", "/admin/users", "/admin/audit"]) {
        await gotoReady(page, path);
        await expect(page.getByRole("heading", { name: NOT_FOUND }), path).toBeVisible();
      }
    });
  });
});

test.describe("admin actions (the owner)", () => {
  test("let one person in from the waitlist, and remove another", async ({ page }, testInfo) => {
    const letIn = target(testInfo, "letin");
    const letInName = letIn.name;
    const removeName = target(testInfo, "remove").name;
    await gotoReady(page, "/admin/waitlist");
    await expect(pageHeading(page)).toHaveText("Waitlist");
    await expect(page.getByText(/\d+ places? free · \d+ waiting/)).toBeVisible();

    await page.getByRole("button", { name: `Let in ${letInName}` }).click();
    await expect(page.getByRole("status").filter({ hasText: `${letInName} was let in.` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Let in ${letInName}` })).toHaveCount(0);

    await page.getByRole("button", { name: `Remove ${removeName}` }).click();
    const dialog = page.getByRole("dialog", { name: `Remove ${removeName} from the waitlist?` });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${removeName} was removed from the waitlist.` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove ${removeName}` })).toHaveCount(0);
    // Wren Waiting is still first in line.
    await expect(page.getByRole("button", { name: "Let in Wren Waiting" })).toBeVisible();

    await page.goto("/admin/audit");
    await expect(page.getByText(`Let in @${letIn.login}.`).filter({ visible: true })).toBeVisible();
  });

  test("“Let them in” asks first, and checks the number", async ({ page }) => {
    await gotoReady(page, "/admin/waitlist");
    const field = page.getByRole("textbox", { name: "How many" });
    await field.fill("0");
    await page.getByRole("button", { name: "Let them in" }).click();
    await expect(page.getByText(/^Enter a number from 1 to \d+\.$/)).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await field.fill("1");
    await page.getByRole("button", { name: "Let them in" }).click();
    const dialog = page.getByRole("dialog", { name: "Let in the next person?" });
    // Not destructive: focus starts on the confirm button.
    await expect(dialog.getByRole("button", { name: "Let them in" })).toBeFocused();
    // Cancel: letting the head of the queue in would change the shared waitlist.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("suspend a person, then reactivate them", async ({ page }, testInfo) => {
    const name = target(testInfo, "suspend").name;
    await gotoReady(page, "/admin/users");
    await page.getByRole("searchbox", { name: "Search this page" }).fill(name);
    await expect(page.getByRole("button", { name: `Suspend ${name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Suspend / })).toHaveCount(1);

    await page.getByRole("button", { name: `Suspend ${name}` }).click();
    const dialog = page.getByRole("dialog", { name: `Suspend ${name}?` });
    await expect(dialog).toHaveAccessibleDescription(/signed out at once/);
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} is suspended.` })).toBeVisible();
    const reactivate = page.getByRole("button", { name: `Reactivate ${name}` });
    await expect(reactivate).toBeFocused();

    await reactivate.click();
    await expect(page.getByRole("status").filter({ hasText: `${name} can sign in again.` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Suspend ${name}` })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users\?q=/);
  });

  test("change the cap (and the raise and lower questions)", async ({ page }, testInfo) => {
    await gotoReady(page, "/admin/sign-up");
    await expect(pageHeading(page)).toHaveText("Sign-up");
    const field = page.getByRole("textbox", { name: "User cap" });
    await field.fill("1001");
    await page.getByRole("button", { name: "Save cap" }).click();
    await expect(page.getByText("Enter a whole number from 0 to 1,000.")).toBeVisible();

    // Raising while people wait asks first (Cancel: it would let the shared waitlist in).
    await field.fill("1000");
    await page.getByRole("button", { name: "Save cap" }).click();
    const raise = page.getByRole("dialog", { name: "Raise the cap to 1,000?" });
    await expect(raise).toHaveAccessibleDescription(/^This lets in the next \d+ people from the waitlist/);
    await raise.getByRole("button", { name: "Cancel" }).click();

    // Lowering below the places taken asks too.
    await field.fill("0");
    await page.getByRole("button", { name: "Save cap" }).click();
    const lower = page.getByRole("dialog", { name: "Lower the cap to 0?" });
    await expect(lower).toHaveAccessibleDescription(/already have places\. Nobody loses theirs/);
    await lower.getByRole("button", { name: "Cancel" }).click();

    // One real change, on one screen size only: down to 99 (nobody is let in, free places stay).
    if (!isPhone(testInfo)) {
      await field.fill("99");
      await page.getByRole("button", { name: "Save cap" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Cap saved: 99 places." })).toBeVisible();
    }
  });

  test("the Admins page shows the owner's locked card and Ada's permissions", async ({ page }) => {
    await gotoReady(page, "/admin/admins");
    await expect(page.getByText("Has every permission. This can't be changed here.")).toBeVisible();
    const ada = page.getByRole("region", { name: "Ada Admin, admin" });
    await expect(ada.getByRole("checkbox", { name: "See the overview" })).toBeChecked();
    await expect(ada.getByRole("checkbox", { name: "Manage the waitlist" })).not.toBeChecked();
    await expect(ada.getByRole("button", { name: "Save changes" })).toBeDisabled();
    // Unknown username.
    await page.getByRole("textbox", { name: "GitHub username" }).fill("nobody-here");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.getByText("No active user has that username.")).toBeVisible();
    await page.getByRole("textbox", { name: "GitHub username" }).fill("wren-waiting");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.getByText("Only people with a place can be admins.")).toBeVisible();
  });
});
