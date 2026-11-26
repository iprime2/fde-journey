// Test sign-in for the end-to-end tests. playwright.config.ts creates a random secret and session
// token for each run; scripts/e2e-seed.mjs stores the token as the made-up owner's session in a
// fresh local test database; the fixtures send it as a cookie signed with the secret, exactly as
// Better Auth would after a real GitHub sign-in. No real credential is involved anywhere.
import { createHash, createHmac, randomBytes } from "node:crypto";

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
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
export const SPARE_ATTEMPTS = 3;

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
export const E2E_USER_KEYS = ["active", "waitlisted", "suspended", "admin"] as const;
export type E2eUser = (typeof E2E_USER_KEYS)[number];

export function userSessionToken(user: E2eUser, project: string, attempt: number): string {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= SPARE_ATTEMPTS) {
    throw new Error(`No session for attempt ${attempt + 1}: raise SPARE_ATTEMPTS in tests/e2e/auth.ts.`);
  }
  const { secret } = e2eRunSecrets();
  return createHmac("sha256", secret).update(`e2e-user-session\n${user}\n${project}\n${attempt}`).digest("base64url");
}

/** Every user session, as `user:token` pairs, for the seed (E2E_USER_SESSION_TOKENS). */
export function userSessionTokens(projects: readonly string[]): string[] {
  return E2E_USER_KEYS.flatMap((user) =>
    projects.flatMap((project) => Array.from({ length: SPARE_ATTEMPTS }, (_, attempt) => `${user}:${userSessionToken(user, project, attempt)}`)),
  );
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
