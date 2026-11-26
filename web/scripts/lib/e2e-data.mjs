// Made-up data for the end-to-end seed (scripts/e2e-seed.mjs), shared with the tests that check it
// (tests/e2e/isolation.spec.ts). Nothing here is real.

/** A second user, never the owner. Can't sign in while sign-in is owner-only (M4a). */
export const E2E_OTHER_USER = "e2e-other";
export const E2E_OTHER_GITHUB_ID = "900000000002";
/** Text that must never appear on the owner's pages. */
export const E2E_OTHER_NOTE = "Other user's made-up note, never shown to the owner.";
export const E2E_OTHER_LINK = "https://example.com/other-user";
/** One done item per section, so every section's done count would show a leak. */
export const E2E_OTHER_DONE = ["l1-1", "r1-1-1", "pp1", "bk1", "s1-1", "c1-1", "p1-1", "k1"];

/**
 * M4b: made-up users in every state, for the waitlist, suspension, admin and export flows. Each has
 * its own sessions (tests/e2e/auth.ts, userSessionToken), so tests can act as any of them.
 */
export const E2E_USERS = {
  active: { id: "e2e-active", name: "Riley Active", githubId: "900000000003", login: "riley-active", status: "active", permissions: [] },
  waitlisted: { id: "e2e-waitlisted", name: "Wren Waiting", githubId: "900000000004", login: "wren-waiting", status: "waitlisted", permissions: [] },
  suspended: { id: "e2e-suspended", name: "Sid Suspended", githubId: "900000000005", login: "sid-suspended", status: "suspended", permissions: [] },
  admin: { id: "e2e-admin", name: "Ada Admin", githubId: "900000000006", login: "ada-admin", status: "active", permissions: ["metrics.view", "users.view", "audit.view"] },
  // Spare users for the flows that change a user (Settings, deleting, leaving the waitlist). One
  // per screen size, because the desktop and phone runs of a test happen at the same time.
  "settings-desktop": { id: "e2e-settings-d", name: "Sky Settings", githubId: "900000000011", login: "sky-settings", status: "active", permissions: [] },
  "settings-phone": { id: "e2e-settings-p", name: "Sol Settings", githubId: "900000000012", login: "sol-settings", status: "active", permissions: [] },
  "deleter-desktop": { id: "e2e-deleter-d", name: "Dee Deleting", githubId: "900000000013", login: "dee-deleting", status: "active", permissions: [] },
  "deleter-phone": { id: "e2e-deleter-p", name: "Dov Deleting", githubId: "900000000014", login: "dov-deleting", status: "active", permissions: [] },
  "leaver-desktop": { id: "e2e-leaver-d", name: "Lee Leaving", githubId: "900000000015", login: "lee-leaving", status: "waitlisted", permissions: [] },
  "leaver-phone": { id: "e2e-leaver-p", name: "Lou Leaving", githubId: "900000000016", login: "lou-leaving", status: "waitlisted", permissions: [] },
};

/**
 * Made-up people that admin tests act on (no sessions): let in, removed from the waitlist,
 * suspended and reactivated. One per screen size. They joined the waitlist after Wren Waiting, so
 * Wren stays first in line.
 */
export const E2E_TARGETS = {
  "letin-desktop": { id: "e2e-letin-d", name: "Lana Letin", githubId: "900000000021", login: "lana-letin", status: "waitlisted" },
  "letin-phone": { id: "e2e-letin-p", name: "Leo Letin", githubId: "900000000022", login: "leo-letin", status: "waitlisted" },
  "remove-desktop": { id: "e2e-remove-d", name: "Rae Remove", githubId: "900000000023", login: "rae-remove", status: "waitlisted" },
  "remove-phone": { id: "e2e-remove-p", name: "Rex Remove", githubId: "900000000024", login: "rex-remove", status: "waitlisted" },
  "suspend-desktop": { id: "e2e-suspend-d", name: "Sue Spare", githubId: "900000000025", login: "sue-spare", status: "active" },
  "suspend-phone": { id: "e2e-suspend-p", name: "Stu Spare", githubId: "900000000026", login: "stu-spare", status: "active" },
};

/** A made-up Scaler access code for the test database (the seed stores only its hash). */
export const E2E_SCALER_CODE = "MADE-UP-CODE-2026";
/** The active user's saved progress: what their export key returns. */
export const E2E_ACTIVE_DONE = ["l1-1", "pp1"];
export const E2E_ACTIVE_NOTE = "Riley's made-up note, readable only with Riley's export key.";
