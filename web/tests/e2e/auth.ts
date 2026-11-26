// Test sign-in for the end-to-end tests. playwright.config.ts creates a random secret and session
// token for each run; scripts/e2e-seed.mjs stores the token as the made-up owner's session in a
// fresh local test database; the fixtures send it as a cookie signed with the secret, exactly as
// Better Auth would after a real GitHub sign-in. No real credential is involved anywhere.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { E2E_ATTEMPTS } from "../../scripts/lib/e2e-data.mjs";

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/**
 * A second test server with SIGNUP_MODE unset (owner-only, the production default), its own test
 * database and the same made-up users, for tests/e2e/owner-only.spec.ts (project "owner-only").
 */
export const E2E_OWNER_ONLY_PORT = 3200;
export const E2E_OWNER_ONLY_URL = `http://localhost:${E2E_OWNER_ONLY_PORT}`;
/** Made-up GitHub id for the test owner. */
export const E2E_OWNER_GITHUB_ID = "900000000001";
export const SESSION_COOKIE = "better-auth.session_token";

/**
 * The run's secret and session token. Created once in the runner process and kept in its
 * environment, which the test workers and the web server inherit.
 */
export function e2eRunSecrets(): { secret: string; token: string } {
  const secret = process.env.E2E_AUTH_SECRET || randomBytes(32).toString("base64url");
  const token = process.env.E2E_SESSION_TOKEN || randomBytes(32).toString("base64url");
  process.env.E2E_AUTH_SECRET = secret;
  process.env.E2E_SESSION_TOKEN = token;
  return { secret, token };
}

/**
 * Every test shares one session ("shared"). A test that ends its session (signing out) would sign
 * every other test out with it, so it asks for a spare one instead: `test.use({ session: "sign-out" })`.
 * Add a name here for each new test that ends its session.
 */
export const SPARE_SESSIONS = ["sign-out", "signing-out"] as const;
export type SpareSession = (typeof SPARE_SESSIONS)[number];
export type E2eSession = "shared" | SpareSession;

/**
 * Runs of one test (the first plus retries) that each get their own spare session. Repeats made
 * with `--repeat-each` (local runs only) are not attempts: they would share one, so don't repeat
 * tests that sign out.
 */
export const SPARE_ATTEMPTS: number = E2E_ATTEMPTS;

/**
 * A spare session's token: one per name, project and attempt, so desktop and phone (which run the
 * same test at the same time) and a retry never share one. Derived from the run's secret, so the
 * runner (which seeds them) and the workers (which sign them) agree without passing a list around.
 */
export function spareSessionToken(name: SpareSession, project: string, attempt: number): string {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= SPARE_ATTEMPTS) {
    throw new Error(`No spare session for attempt ${attempt + 1}: raise SPARE_ATTEMPTS in tests/e2e/auth.ts.`);
  }
  const { secret } = e2eRunSecrets();
  return createHmac("sha256", secret).update(`e2e-spare-session\n${name}\n${project}\n${attempt}`).digest("base64url");
}

/**
 * M4b's made-up users (scripts/lib/e2e-data.mjs, E2E_USERS). A test acts as one with
 * `test.use({ as: "waitlisted" })`. Each has its own session per project and attempt, as spare
 * sessions do, so a test that ends one (a suspended user's is ended on sight) touches no other.
 */
export const SHARED_USERS = ["active", "waitlisted", "suspended", "admin"] as const;
export type SharedUser = (typeof SHARED_USERS)[number];

/**
 * Spare users that tests change for good (scripts/lib/e2e-data.mjs): `test.use({ as: "deleter" })`
 * signs in as "deleter-desktop-0" or "deleter-phone-0" by the project, and as "…-1" on the retry,
 * so neither the two screen sizes nor a retry ever share one.
 */
export const PER_PROJECT_USERS = ["settings", "deleter", "leaver"] as const;
export type PerProjectUser = (typeof PER_PROJECT_USERS)[number];
export type Screen = "desktop" | "phone";
export type SpareUser = `${PerProjectUser}-${Screen}-${number}`;
export type E2eUser = SharedUser | SpareUser;

/** The screen size a project tests: phone projects start with "phone"; everything else is desktop. */
export const screenOf = (project: string): Screen => (project.startsWith("phone") ? "phone" : "desktop");

/** The spare user a test signs in as, for its project and attempt (testInfo.retry). */
export const spareUserFor = (role: PerProjectUser, project: string, attempt: number): SpareUser => `${role}-${screenOf(project)}-${attempt}`;

export function userSessionToken(user: E2eUser, project: string, attempt: number): string {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= SPARE_ATTEMPTS) {
    throw new Error(`No session for attempt ${attempt + 1}: raise E2E_ATTEMPTS in scripts/lib/e2e-data.mjs.`);
  }
  const { secret } = e2eRunSecrets();
  return createHmac("sha256", secret).update(`e2e-user-session\n${user}\n${project}\n${attempt}`).digest("base64url");
}

/**
 * Every user session, as `user:token` pairs, for the seed (E2E_USER_SESSION_TOKENS). Shared users
 * get one per project and attempt; a spare user only the ones it is used in (projects of its screen
 * size, its own attempt), which keeps the list well under the seed guard's limit of 128.
 */
export function userSessionTokens(projects: readonly string[]): string[] {
  const shared = SHARED_USERS.flatMap((user) =>
    projects.flatMap((project) => Array.from({ length: SPARE_ATTEMPTS }, (_, attempt) => `${user}:${userSessionToken(user, project, attempt)}`)),
  );
  const spare = PER_PROJECT_USERS.flatMap((role) =>
    projects.flatMap((project) =>
      Array.from({ length: SPARE_ATTEMPTS }, (_, attempt) => {
        const user = spareUserFor(role, project, attempt);
        return `${user}:${userSessionToken(user, project, attempt)}`;
      }),
    ),
  );
  return [...shared, ...spare];
}

/** The active user's Claude export key for this run (made up; the seed stores only its hash). */
export function e2eExportKey(): string {
  const { secret } = e2eRunSecrets();
  return `fdej_${createHmac("sha256", secret).update("e2e-export-key").digest("base64url")}`;
}

/** The key's SHA-256, as the app stores it (lib/export-token.ts). */
export const e2eExportKeyHash = () => createHash("sha256").update(e2eExportKey(), "utf8").digest("hex");

/** Every spare session's token, for the seed (E2E_SPARE_SESSION_TOKENS). */
export function spareSessionTokens(projects: readonly string[]): string[] {
  return SPARE_SESSIONS.flatMap((name) =>
    projects.flatMap((project) => Array.from({ length: SPARE_ATTEMPTS }, (_, attempt) => spareSessionToken(name, project, attempt))),
  );
}

/** Better Auth's signed cookie value: token, ".", base64 HMAC-SHA256 of the token. */
export function signedSessionCookie(token = e2eRunSecrets().token) {
  const { secret } = e2eRunSecrets();
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}
