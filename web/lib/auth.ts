// Better Auth set-up: GitHub sign-in. Server-only.
//
// Who may sign in depends on SIGNUP_MODE (lib/signup-mode.ts).
//
// Owner-only (the default), enforced three times:
// 1. `user.validateUserInfo` (lib/owner.ts) rejects any other GitHub account before a user,
//    account or session row is written, on sign-up, account linking and every sign-in.
// 2. `databaseHooks.session.create.before` refuses to create a session for a user without the
//    owner's GitHub account, whatever path asked for it.
// 3. lib/session.ts re-checks the account on every request before returning a session.
//
// Capped (M4b): any GitHub account.
// 1. `user.validateUserInfo` (cappedGate) refuses a suspended account at sign-in with
//    `?error=suspended`, before any session is written.
// 2. A new user is stored as waitlisted (`databaseHooks.user.create.before`), so a failure later
//    leaves them waiting, never with a place they didn't get. Once their GitHub account row exists
//    (`account.create.after`) they take a free place if one is theirs, under the places lock
//    (lib/places.ts). The owner always gets a place and never counts toward the cap.
// 3. `session.create.before` refuses suspended users; lib/session.ts re-checks the status on every
//    request (waitlisted users only reach /waitlist).
//
// In both modes the GitHub username is stored at sign-up and refreshed at every sign-in, the owner's
// settings row is made (every section on, Scaler unlocked), and the sign-in counts as activity.
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { and, eq, lt, sql } from "drizzle-orm";
import { type Db, getDb } from "@/db/client";
import { account, authSchema, user, verification } from "@/db/schema";
import { loadAccess } from "./access";
import { touchActivity } from "./activity";
import { SUSPENDED_ERROR } from "./login";
import { type IdentityCheck, NOT_OWNER, isOwnerGithubId, ownerGate, ownerGithubId } from "./owner";
import { activateOwner, placeNewUser } from "./places";
import { betterAuthLog, describeError } from "./safe-log";
import { ensureOwnerSettings } from "./settings-db";
import { type SignupMode, signupMode } from "./signup-mode";

type Env = Record<string, string | undefined>;

/** Sessions last 30 days and are extended once a day while the app is in use. */
const SESSION_DAYS = 30;

// Better Auth endpoints this app never uses. They answer 404 over HTTP. Sign-in with GitHub,
// the callback, get-session, sign-out and session listing stay available.
const DISABLED_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
  "/verify-password",
  "/send-verification-email",
  "/verify-email",
  "/change-email",
  "/update-user",
  "/delete-user",
  "/delete-user/callback",
  "/link-social",
  "/unlink-account",
  "/get-access-token",
  "/refresh-token",
  "/account-info",
  "/update-session",
];

/** True when the user has the owner's GitHub account linked. */
export async function isOwnerUser(db: Db, userId: string, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return false;
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github"), eq(account.accountId, ownerId)))
    .limit(1);
  return rows.length > 0;
}

const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;

/** A GitHub username as GitHub sends it, or null if it doesn't look like one. */
export function cleanGithubLogin(value: unknown): string | null {
  return typeof value === "string" && GITHUB_LOGIN.test(value) ? value : null;
}

/** validateUserInfo's answer for a suspended account: Better Auth sends the browser to /login?error=suspended. */
export const SUSPENDED = { error: SUSPENDED_ERROR, errorDescription: "This account is suspended." } as const;

const isGithubId = (id: unknown) =>
  (typeof id === "number" && Number.isSafeInteger(id) && id > 0) || (typeof id === "string" && /^[1-9]\d{0,19}$/.test(id));

/** Stores the GitHub username GitHub just sent, if it changed. Never blocks sign-in. */
async function refreshGithubLogin(db: Db, userId: unknown, login: unknown): Promise<void> {
  const clean = cleanGithubLogin(login);
  if (typeof userId !== "string" || !userId || !clean) return;
  try {
    await db.execute(sql`update ${user} set "github_login" = ${clean} where ${user.id} = ${userId} and "github_login" is distinct from ${clean}`);
  } catch (error) {
    console.error(`Refreshing the GitHub username failed (${describeError(error)})`);
  }
}

/**
 * Capped mode's `validateUserInfo`: any GitHub account may sign up or sign in, except a suspended
 * one. Runs with GitHub's fresh profile before anything is written. Without OWNER_GITHUB_ID nobody
 * gets in (there would be no super admin).
 */
export async function cappedGate(db: Db, data: IdentityCheck, ownerId: string | null): Promise<typeof NOT_OWNER | typeof SUSPENDED | undefined> {
  const { source } = data;
  if (!ownerId) return NOT_OWNER;
  if (source.method !== "oauth" || source.oauth?.providerId !== "github") return NOT_OWNER;
  if (!isGithubId(source.oauth.profile?.id)) return NOT_OWNER;
  if (source.action === "create-user") return undefined;
  if (source.action !== "sign-in") return NOT_OWNER; // account linking is off; nothing else is expected
  const userId = data.user?.id;
  if (typeof userId !== "string") return NOT_OWNER;
  const access = await loadAccess(db, userId, ownerId);
  if (!access) return NOT_OWNER;
  if (access.status === "suspended" && !access.isOwner) return SUSPENDED;
  return undefined;
}

/** `session.create.before`: may this user have a session? */
export async function sessionAllowed(db: Db, userId: string, ownerId: string | null, mode: SignupMode): Promise<boolean> {
  if (mode === "owner-only") {
    const owner = await isOwnerUser(db, userId, ownerId);
    if (owner) await ownerSetUp(db, userId);
    return owner;
  }
  if (!ownerId) return false;
  const access = await loadAccess(db, userId, ownerId);
  if (!access) return false;
  if (access.isOwner) {
    await activateOwner(db, userId);
    await ownerSetUp(db, userId);
    return true;
  }
  return access.status !== "suspended";
}

/** The owner's settings row (all sections, Scaler unlocked). Never blocks sign-in. */
async function ownerSetUp(db: Db, userId: string): Promise<void> {
  try {
    await ensureOwnerSettings(userId, db);
  } catch (error) {
    console.error(`Setting up the owner's settings failed (${describeError(error)})`);
  }
}

/**
 * `account.create.after`, for a new GitHub sign-up: the owner gets a place at once; anyone else (in
 * capped mode) takes a free place if one is theirs, under the places lock. A failure leaves them
 * on the waitlist (where user.create.before put them) and never fails the sign-in.
 */
export async function placeNewAccount(db: Db, created: { userId: string; providerId: string; accountId: string }, ownerId: string | null, mode: SignupMode): Promise<void> {
  if (created.providerId !== "github") return;
  try {
    if (isOwnerGithubId(created.accountId, ownerId)) await activateOwner(db, created.userId);
    else if (mode === "capped") await placeNewUser(db, created.userId, ownerId);
  } catch (error) {
    console.error(`Giving a new account its place failed (${describeError(error)})`);
  }
}

/**
 * Deletes expired verification rows (old OAuth states) in one indexed query. Never blocks
 * sign-in: a failure here only means the rows wait for the next attempt.
 */
export async function deleteExpiredVerifications(db: Db, now = new Date()): Promise<void> {
  try {
    await db.delete(verification).where(lt(verification.expiresAt, now));
  } catch (error) {
    console.error(`Clearing expired sign-in attempts failed (${describeError(error)})`);
  }
}

/**
 * Builds the auth instance. Exported for tests, which pass an in-memory database.
 * `writeCookies: false` gives an instance that never sets cookies through Next (see getSessionReader).
 */
export function createAuth({ db, env, writeCookies = true }: { db: Db; env: Env; writeCookies?: boolean }) {
  const ownerId = ownerGithubId(env);
  const mode = signupMode(env);
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set. See web/.env.example.");
  const clientId = env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = env.GITHUB_CLIENT_SECRET?.trim();

  return betterAuth({
    appName: "FDE Journey",
    secret,
    baseURL: env.BETTER_AUTH_URL?.trim() || undefined,
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    // Without GitHub credentials the app still runs (tests, previews); sign-in then fails cleanly.
    socialProviders:
      clientId && clientSecret
        ? { github: { clientId, clientSecret } }
        : {},
    account: {
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    session: { expiresIn: SESSION_DAYS * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    user: {
      validateUserInfo: async (data) => {
        const refused = mode === "capped" ? await cappedGate(db, data, ownerId) : ownerGate(data, ownerId);
        if (refused) return refused;
        // An existing user signing in: keep their GitHub username current (it can be renamed).
        if (data.source.action === "sign-in") await refreshGithubLogin(db, data.user?.id, data.source.oauth?.profile?.login);
        // A new user: hand GitHub's username to user.create.before. Better Auth passes this same
        // `user` object on to the create (lib/db internal-adapter createUser), and githubLogin is
        // `input: false`, so nothing else can fill it. If that ever stops reaching the row, the
        // username is filled at the user's next sign-in instead (refreshGithubLogin).
        if (data.source.action === "create-user" && data.user) data.user.githubLogin = cleanGithubLogin(data.source.oauth?.profile?.login);
        return undefined;
      },
      // M4b columns on "user" (db/schema.ts). Only githubLogin comes from GitHub (set above, from
      // the profile GitHub just sent); `input: false` on all of them, so nothing a browser sends can
      // set any (and the endpoints that take user input are disabled anyway).
      additionalFields: {
        githubLogin: { type: "string", required: false, input: false },
        status: { type: "string", required: false, input: false },
        activatedAt: { type: "date", required: false, input: false },
        waitlistedAt: { type: "date", required: false, input: false },
        lastActiveAt: { type: "date", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Capped: every new account starts on the waitlist, and takes a place only once its
          // GitHub account is stored (account.create.after). Owner-only: only the owner gets here.
          before: async (data) => {
            const githubLogin = cleanGithubLogin((data as { githubLogin?: unknown }).githubLogin);
            const now = new Date();
            return mode === "capped"
              ? { data: { ...data, githubLogin, status: "waitlisted", waitlistedAt: now, activatedAt: null } }
              : { data: { ...data, githubLogin, status: "active", activatedAt: now, waitlistedAt: null } };
          },
        },
      },
      account: {
        create: {
          after: async (created) => placeNewAccount(db, created, ownerId, mode),
        },
      },
      session: {
        create: {
          before: async (session) => ((await sessionAllowed(db, session.userId, ownerId, mode)) ? undefined : false),
          // Signing in counts as being active (at most one write an hour).
          after: async (session) => touchActivity(db, session.userId),
        },
      },
      verification: {
        create: {
          // Each sign-in start stores its OAuth state for 10 minutes. Better Auth only clears
          // expired rows when a callback arrives, so starts that never come back (or a script
          // calling the sign-in action) would pile up. Clear them before every new one.
          before: async () => {
            await deleteExpiredVerifications(db);
          },
        },
      },
    },
    disabledPaths: DISABLED_PATHS,
    // Where sign-in errors go when the flow's own error address is unknown (an expired or
    // forged OAuth state, a callback without state) and for /api/auth/error. Better Auth adds
    // `?error=<code>`, so /login shows "Sign-in didn't finish. Try again." instead of Better
    // Auth's own error page. Flows that started normally return to their own /login?next=… address.
    //
    // `throw: true`: an endpoint that fails with anything but Better Auth's own APIError (a
    // database error in the GitHub callback, for one) is thrown out of auth.handler instead of
    // being printed whole by the router underneath (better-call's "# SERVER_ERROR", which quoted
    // the failed query's parameters: the new session token, user id, IP address and browser).
    // app/api/auth/[...all]/route.ts logs it safely and answers. Redirects and APIError answers
    // are unchanged: the router still turns them into responses.
    onAPIError: { errorURL: "/login", throw: true },
    // Better Auth skips its origin and CSRF checks when NODE_ENV is "test". Keep them on
    // everywhere, so tests exercise the same protection as production.
    advanced: { disableOriginCheck: false },
    telemetry: { enabled: false },
    // Better Auth's default logger prints whole errors: a failed session lookup printed the
    // query's parameters, the session token among them. This one prints error names and codes
    // only, and nothing for Next's own prerender interruptions (lib/safe-log.ts). No `level`:
    // the default is already "warn", and setting one makes Better Auth's router also print error
    // messages through its global default logger, bypassing this one.
    logger: { log: betterAuthLog },
    // Lets Server Actions that call auth.api (sign-in, sign-out, renewal) set cookies. Must stay last.
    plugins: writeCookies ? [nextCookies()] : [],
  });
}

export type Auth = ReturnType<typeof createAuth>;

type AuthKey = "__fdeJourneyAuth" | "__fdeJourneySessionReader";
const store = globalThis as typeof globalThis & { [K in AuthKey]?: Promise<Auth> };

function memoised(key: AuthKey, writeCookies: boolean): Promise<Auth> {
  if (!store[key]) {
    store[key] = getDb()
      .then((db) => createAuth({ db, env: process.env, writeCookies }))
      .catch((error: unknown) => {
        store[key] = undefined;
        throw error;
      });
  }
  return store[key];
}

/**
 * The app's auth instance, created on first use (so builds and pages without sign-in skip it).
 * In a Server Action it sets the cookies Better Auth asks for: the sign-in state, sign-out, renewal.
 */
export function getAuth(): Promise<Auth> {
  return memoised("__fdeJourneyAuth", true);
}

/**
 * The same auth set-up, but it never sets cookies: for checking who the visitor is (lib/session.ts).
 * When a validly signed cookie's session has ended, Better Auth deletes the cookie. In a Server
 * Action, Next answers any cookie change by re-rendering the page, which then redirects to /login:
 * a refused save would take the owner away from the page and the note they were typing. A save
 * must answer "signed-out" instead and leave the page alone; the next page visit goes to /login.
 */
export function getSessionReader(): Promise<Auth> {
  return memoised("__fdeJourneySessionReader", false);
}
