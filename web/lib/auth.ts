// Better Auth set-up: GitHub sign-in for the owner only. Server-only.
//
// The owner rule is enforced three times:
// 1. `user.validateUserInfo` (lib/owner.ts) rejects any other GitHub account before a user,
//    account or session row is written, on sign-up, account linking and every sign-in.
// 2. `databaseHooks.session.create.before` refuses to create a session for a user without the
//    owner's GitHub account, whatever path asked for it.
// 3. lib/session.ts re-checks the account on every request before returning a session.
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { and, eq, lt } from "drizzle-orm";
import { type Db, getDb } from "@/db/client";
import { account, authSchema, verification } from "@/db/schema";
import { ownerGate, ownerGithubId } from "./owner";
import { betterAuthLog, describeError } from "./safe-log";

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
    socialProviders: clientId && clientSecret ? { github: { clientId, clientSecret } } : {},
    account: {
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    session: { expiresIn: SESSION_DAYS * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    user: {
      validateUserInfo: (data) => ownerGate(data, ownerId),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ((await isOwnerUser(db, session.userId, ownerId)) ? undefined : false),
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
