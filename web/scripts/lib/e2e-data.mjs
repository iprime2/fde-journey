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
 * Runs of one test (the first plus retries) that each get their own spare session or spare user.
 * CI retries once; locally there are none. tests/e2e/auth.ts uses the same number.
 */
export const E2E_ATTEMPTS = 3;
export const E2E_SCREENS = ["desktop", "phone"];

/**
 * Spare users that tests change for good (Settings, deleting the account, leaving the waitlist):
 * one per screen size (the desktop and phone runs of a test happen at the same time) AND per attempt,
 * so a retry never finds its user already changed or deleted. Attempt 0 keeps the base name; a
 * retry's user is "Sky Settings 2", login "sky-settings-2", and so on.
 */
const SPARE_USER_BASES = {
  settings: { status: "active", desktop: ["Sky Settings", "sky-settings"], phone: ["Sol Settings", "sol-settings"] },
  deleter: { status: "active", desktop: ["Dee Deleting", "dee-deleting"], phone: ["Dov Deleting", "dov-deleting"] },
  leaver: { status: "waitlisted", desktop: ["Lee Leaving", "lee-leaving"], phone: ["Lou Leaving", "lou-leaving"] },
};
export const E2E_SPARE_ROLES = Object.keys(SPARE_USER_BASES);

/**
 * Made-up people that admin tests act on (no sessions): let in, removed from the waitlist,
 * suspended and reactivated. Per screen size and attempt, like the spare users. They joined the
 * waitlist after Wren Waiting, so Wren stays first in line.
 */
const TARGET_BASES = {
  letin: { status: "waitlisted", desktop: ["Lana Letin", "lana-letin"], phone: ["Leo Letin", "leo-letin"] },
  remove: { status: "waitlisted", desktop: ["Rae Remove", "rae-remove"], phone: ["Rex Remove", "rex-remove"] },
  suspend: { status: "active", desktop: ["Sue Spare", "sue-spare"], phone: ["Stu Spare", "stu-spare"] },
};

/** Made-up GitHub ids for generated people: 9000000001xx, never the owner's or Alex's. */
let nextGithubId = 900000000100;
function generate(bases, prefix) {
  const out = {};
  for (const [role, base] of Object.entries(bases)) {
    for (const screen of E2E_SCREENS) {
      for (let attempt = 0; attempt < E2E_ATTEMPTS; attempt++) {
        const [name, login] = base[screen];
        const suffix = attempt === 0 ? "" : ` ${attempt + 1}`;
        out[`${role}-${screen}-${attempt}`] = {
          id: `e2e-${prefix}${role}-${screen[0]}-${attempt}`,
          name: `${name}${suffix}`,
          githubId: String(nextGithubId++),
          login: `${login}${attempt === 0 ? "" : `-${attempt + 1}`}`,
          status: base.status,
          permissions: [],
        };
      }
    }
  }
  return out;
}

/**
 * M4b: made-up users in every state, for the waitlist, suspension, admin and export flows. Each has
 * its own sessions (tests/e2e/auth.ts, userSessionToken), so tests can act as any of them.
 */
export const E2E_USERS = {
  active: { id: "e2e-active", name: "Riley Active", githubId: "900000000003", login: "riley-active", status: "active", permissions: [] },
  waitlisted: { id: "e2e-waitlisted", name: "Wren Waiting", githubId: "900000000004", login: "wren-waiting", status: "waitlisted", permissions: [] },
  suspended: { id: "e2e-suspended", name: "Sid Suspended", githubId: "900000000005", login: "sid-suspended", status: "suspended", permissions: [] },
  admin: { id: "e2e-admin", name: "Ada Admin", githubId: "900000000006", login: "ada-admin", status: "active", permissions: ["metrics.view", "users.view", "audit.view"] },
  ...generate(SPARE_USER_BASES, ""),
};

export const E2E_TARGETS = generate(TARGET_BASES, "target-");

/** The spare user for a role, screen ("desktop" or "phone") and attempt. */
export const e2eSpareUser = (role, screen, attempt) => E2E_USERS[`${role}-${screen}-${attempt}`];
/** The admin tests' target for a role ("letin", "remove", "suspend"), screen and attempt. */
export const e2eTarget = (role, screen, attempt) => E2E_TARGETS[`${role}-${screen}-${attempt}`];

/** A made-up Scaler access code for the test database (the seed stores only its hash). */
export const E2E_SCALER_CODE = "MADE-UP-CODE-2026";
/** The active user's saved progress: what their export key returns. */
export const E2E_ACTIVE_DONE = ["l1-1", "pp1"];
export const E2E_ACTIVE_NOTE = "Riley's made-up note, readable only with Riley's export key.";
