// Made-up data for the end-to-end seed (scripts/e2e-seed.mjs), shared with the tests that check it
// (tests/e2e/isolation.spec.ts). Nothing here is real.

/** A second user, never the owner. Can't sign in while sign-in is owner-only (M4a). */
export const E2E_OTHER_USER = "e2e-other";
export const E2E_OTHER_GITHUB_ID = "900000000002";
/** Text that must never appear on the owner's pages. */
export const E2E_OTHER_NOTE = "Other user's made-up note, never shown to the owner.";
export const E2E_OTHER_LINK = "https://example.com/other-user";
/**
 * One done item per section, so every section's done count would show a leak. The course, cr4,
 * gives a badge, so a leak would also show in "Badges earned". No e2e test ticks cr4 for the owner.
 */
export const E2E_OTHER_DONE = ["l1-1", "r1-1-1", "pp1", "bk1", "s1-1", "c1-1", "p1-1", "k1", "cr4"];

/**
 * Runs of one test (the first plus retries) that each get their own spare session or spare user.
 * CI retries once; locally there are none. tests/e2e/auth.ts uses the same number.
 */
export const E2E_ATTEMPTS = 3;
export const E2E_SCREENS = ["desktop", "phone"];

/**
 * Spare users that tests change for good (Settings, deleting the account, leaving the waitlist,
 * being let in): one per screen size (the desktop and phone runs of a test happen at the same time)
 * AND per attempt, so a retry never finds its user already changed or deleted. Attempt 0 keeps the
 * base name; a retry's user gets a middle initial, "Sky B. Settings" with login "sky-b-settings", so
 * no name or username contains another (tests find people by name, and searches match parts of
 * names).
 */
const SPARE_USER_BASES = {
  settings: { status: "active", desktop: ["Sky Settings", "sky-settings"], phone: ["Sol Settings", "sol-settings"] },
  deleter: { status: "active", desktop: ["Dee Deleting", "dee-deleting"], phone: ["Dov Deleting", "dov-deleting"] },
  leaver: { status: "waitlisted", desktop: ["Lee Leaving", "lee-leaving"], phone: ["Lou Leaving", "lou-leaving"] },
  // Waitlisted, then let in by the owner during the test (tests/e2e/landing.spec.ts).
  joiner: { status: "waitlisted", desktop: ["Jun Joining", "jun-joining"], phone: ["Jem Joining", "jem-joining"] },
  // M5a: a few weeks of made-up history for the Insights tests (E2E_INSIGHTS_HISTORY). Sessions only
  // in the "desktop" and "phone" projects (tests/e2e/auth.ts), which keeps the seed under its limit.
  insights: { status: "active", desktop: ["Ivy Insights", "ivy-insights"], phone: ["Ike Insights", "ike-insights"] },
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
        const [first, ...rest] = name.split(" ");
        const [loginFirst, ...loginRest] = login.split("-");
        const initial = String.fromCharCode(65 + attempt); // attempt 1: "B", attempt 2: "C"
        out[`${role}-${screen}-${attempt}`] = {
          id: `e2e-${prefix}${role}-${screen[0]}-${attempt}`,
          name: attempt === 0 ? name : `${first} ${initial}. ${rest.join(" ")}`,
          githubId: String(nextGithubId++),
          login: attempt === 0 ? login : `${loginFirst}-${initial.toLowerCase()}-${loginRest.join("-")}`,
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

/**
 * Two made-up active people who share one GitHub username (one "renamed" and hasn't signed in
 * since), for the Admins chooser. No sessions; tests only look and choose, never make them admins.
 */
export const E2E_SHARED_LOGIN = "pat-example";
export const E2E_SHARED_LOGIN_PEOPLE = [
  { id: "e2e-shared-1", name: "Pat Example", githubId: "900000000031", login: E2E_SHARED_LOGIN, status: "active", permissions: [] },
  { id: "e2e-shared-2", name: "Pat Example", githubId: "900000000032", login: E2E_SHARED_LOGIN, status: "active", permissions: [] },
];

/** A made-up Scaler access code for the test database (the seed stores only its hash). */
export const E2E_SCALER_CODE = "MADE-UP-CODE-2026";
/** The active user's saved progress: what their export key returns. */
export const E2E_ACTIVE_DONE = ["l1-1", "pp1"];
export const E2E_ACTIVE_NOTE = "Riley's made-up note, readable only with Riley's export key.";

/**
 * M5a: the Insights users' made-up history (each spare "insights" user gets the same). Completions
 * sit on the Monday (00:05 IST) of the week `weeksAgo` before this one, so the week they land in
 * never depends on the day the tests run. The user keeps the new-user sections (Projects and Career
 * off, Scaler locked), so `p1-1` is saved but never counted. Weeks 0 to 2 make the current streak 3,
 * weeks 4 to 7 the longest, 4.
 */
export const E2E_INSIGHTS_DONE = [
  { itemId: "l1-1", weeksAgo: 0 },
  { itemId: "r1-1-1", weeksAgo: 0 },
  { itemId: "cr1", weeksAgo: 0 },
  { itemId: "p1-1", weeksAgo: 0 },
  { itemId: "l1-2", weeksAgo: 1 },
  { itemId: "pp1", weeksAgo: 1 },
  { itemId: "c1-1", weeksAgo: 1 },
  { itemId: "l1-3", weeksAgo: 2 },
  { itemId: "r1-1-2", weeksAgo: 2 },
  { itemId: "bk1", weeksAgo: 4 },
  { itemId: "cr2", weeksAgo: 5 },
  { itemId: "l1-4", weeksAgo: 5 },
  { itemId: "c1-2", weeksAgo: 6 },
  { itemId: "r1-1-3", weeksAgo: 7 },
];
/** The numbers the Insights page shows for that history (shown kinds only). */
export const E2E_INSIGHTS_EXPECTED = { thisWeek: 3, lastWeek: 3, currentStreak: 3, longestStreak: 4, total: 13 };
/**
 * Saves made "now", at seed time: a note saved twice (autosave) and a link on l1-1, and l1-5 ticked
 * then unticked (it counts as activity, never as done).
 */
export const E2E_INSIGHTS_EVENTS_NOW = [
  { itemId: "l1-1", kind: "note" },
  { itemId: "l1-1", kind: "note" },
  { itemId: "l1-1", kind: "link" },
  { itemId: "l1-5", kind: "done" },
  { itemId: "l1-5", kind: "undone" },
];
/** The first IST day with save history (lib/insights.ts EVENT_HISTORY_START): no events before it. */
export const E2E_EVENT_HISTORY_START = "2026-11-26";

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;

/** The instant `weeksAgo` weeks before this IST week's Monday, at 00:05 IST. */
export function e2eIstMonday(nowMs, weeksAgo) {
  const shifted = new Date(nowMs + IST_OFFSET_MS);
  const sinceMonday = (shifted.getUTCDay() + 6) % 7;
  const mondayUtcMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - sinceMonday * DAY_MS;
  return new Date(mondayUtcMidnight - weeksAgo * 7 * DAY_MS - IST_OFFSET_MS + 5 * 60_000);
}

/** The IST date ("YYYY-MM-DD") of an instant. */
export const e2eIstDate = (date) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
