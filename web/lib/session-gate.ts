// The proxy's status check (proxy.ts): from the session cookie to the visitor's standing, in one
// database query, before any page renders. Server-only.
//
// Cost: one indexed query per gated request (every page visit, client navigation and prefetch of
// an app page, and every Server Action, by a visitor with a session cookie; public paths are
// skipped). The session token is unique (session_token_unique) and the owner test reads account by
// user id (account_userId_idx), so it is two index lookups. On Neon over HTTP that is one HTTPS
// round trip; on PGlite an in-process call. Nothing is cached: a status changed a second ago (the
// owner lets someone in, or suspends them) counts on the very next request. If this ever costs too
// much, the lever is a short-lived signed status cookie that /waitlist refreshes.
//
// It agrees with Better Auth on what a live session is, so the proxy is never stricter than the
// pages (that would loop: the proxy sends the visitor to /login, which sees a valid session and
// sends them back): the same cookie secret (the current one when BETTER_AUTH_SECRETS rotates them)
// and the same clock (the server's, not the database's) for expiry.
//
// It never writes: ending a refused session stays with lib/session.ts, which runs on the page the
// visitor is sent to (/login revokes a suspended user's sessions, as before).
//
// The session token never leaves this module: not in logs, not in errors (withSafeErrors keeps
// error names and codes only, never the query's parameters).
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { type Db, GATE_QUERY_TIMEOUT_MS, getGateDb } from "@/db/client";
import { session, user } from "@/db/schema";
import { errorChain } from "./error-chain.mjs";
import { type Standing, standingOf } from "./landing";
import { ownerGithubId } from "./owner";
import { withSafeErrors } from "./safe-log";
import { signupMode } from "./signup-mode";

type Env = Record<string, string | undefined>;

/**
 * The secret Better Auth signs and checks session cookies with: the first ("current") entry of
 * BETTER_AUTH_SECRETS ("<version>:<secret>,…") when set, otherwise BETTER_AUTH_SECRET. Better Auth
 * checks cookies against the current secret only (better-call's getSignedCookie with
 * ctx.context.secret; better-auth/dist/context/create-context.mjs), older versions only decrypt
 * stored data. Throws on a malformed BETTER_AUTH_SECRETS, as Better Auth does: the proxy then
 * fails closed. Null when neither is set.
 */
export function sessionCookieSecret(env: Env): string | null {
  const rotation = env.BETTER_AUTH_SECRETS;
  if (rotation) {
    const current = rotation.split(",")[0].trim();
    const colon = current.indexOf(":");
    const version = Number.parseInt(current.slice(0, colon), 10);
    const value = current.slice(colon + 1).trim();
    if (colon === -1 || !Number.isInteger(version) || version < 0 || !value) throw new Error("BETTER_AUTH_SECRETS is malformed.");
    return value;
  }
  return env.BETTER_AUTH_SECRET?.trim() || null;
}

/**
 * The session token from Better Auth's signed cookie value ("token.signature", already decoded),
 * or null when the signature doesn't match. The same check Better Auth makes (better-call's
 * getSignedCookie: HMAC-SHA256 with the auth secret, base64, 44 characters), in constant time.
 */
export function verifiedSessionToken(cookieValue: string, secret: string): string | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 1) return null;
  const token = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  if (signature.length !== 44 || !signature.endsWith("=")) return null;
  const expected = createHmac("sha256", secret).update(token).digest("base64");
  const given = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? token : null;
}

/**
 * The live session's user status and owner flag, in one query. Null when there is no live
 * session. Expiry is compared with this server's clock, as Better Auth does, not the database's.
 */
export async function readSessionStatus(db: Db, token: string, ownerId: string, now = new Date()): Promise<{ status: unknown; isOwner: boolean } | null> {
  const rows = await db
    .select({
      status: user.status,
      // Written out in full ("user"."id"), as in lib/access.ts: the sub-query has its own table.
      isOwner: sql<boolean>`exists (select 1 from "account" a where a."user_id" = "user"."id" and a."provider_id" = 'github' and a."account_id" = ${ownerId})`,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.token, token), gt(session.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { status: row.status, isOwner: row.isOwner === true || (row.isOwner as unknown) === "t" };
}

/** The status query took too long (any driver). Counts as a network failure: tried once more. */
export class GateTimeoutError extends Error {
  constructor() {
    super("The session status query timed out.");
    this.name = "GateTimeoutError";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GateTimeoutError()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

const NETWORK_NAMES = new Set(["AbortError", "TimeoutError", "GateTimeoutError", "FetchError"]);
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

/**
 * True when the query never got an answer from the database (connection refused or reset, DNS,
 * a timeout, a dropped fetch), so trying again may work. A database's own error (a constraint, a
 * syntax error) is not. Messages are read only to classify, never printed.
 */
export function isNetworkError(error: unknown): boolean {
  return errorChain(error).some((link) => {
    if (typeof link !== "object" || link === null) return false;
    const { name, code, message } = link as { name?: unknown; code?: unknown; message?: unknown };
    if (typeof name === "string" && NETWORK_NAMES.has(name)) return true;
    if (typeof code === "string" && NETWORK_CODES.has(code)) return true;
    if (name === "TypeError" && message === "fetch failed") return true;
    // Neon's driver: a fetch that failed before any answer (it keeps the fetch error as sourceError).
    return name === "NeonDbError" && typeof message === "string" && message.startsWith("Error connecting to database");
  });
}

/** What the proxy needs to know about a cookie. */
export interface GateCheck {
  standing: Standing;
  /**
   * True when the cookie names no live session (a bad signature, or no unexpired session row). The
   * proxy then expires the cookie with its redirect to /login, so a stale cookie can't loop. False
   * when the session is live but refused (owner-only mode, an unknown status): /login keeps the
   * cookie and revokes the session itself, as every page does.
   */
  clearCookie: boolean;
}

interface CheckOptions {
  env?: Env;
  db?: () => Promise<Db>;
  /** Per try. Two tries at most, the second only after a network failure. */
  timeoutMs?: number;
}

/**
 * The visitor's standing from their session cookie value (getSessionCookie). Signed out without
 * OWNER_GITHUB_ID (nobody can use the app then), without a cookie, or with a forged one (no query).
 *
 * Throws a SafeError (names and codes only) when the database can't answer after a second try,
 * and a plain Error when the auth secret is missing or malformed. The proxy refuses the request
 * then (fails closed).
 */
export async function checkSessionCookie(
  cookieValue: string | null,
  { env = process.env, db = getGateDb, timeoutMs = GATE_QUERY_TIMEOUT_MS }: CheckOptions = {},
): Promise<GateCheck> {
  const ownerId = ownerGithubId(env);
  if (!ownerId || !cookieValue) return { standing: "signed-out", clearCookie: false };
  const secret = sessionCookieSecret(env);
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  const token = verifiedSessionToken(cookieValue, secret);
  if (!token) return { standing: "signed-out", clearCookie: true };
  const row = await withSafeErrors("Session status check", async () => {
    const database = await db();
    try {
      return await withTimeout(readSessionStatus(database, token, ownerId), timeoutMs);
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      return await withTimeout(readSessionStatus(database, token, ownerId), timeoutMs);
    }
  });
  return { standing: standingOf(row, signupMode(env)), clearCookie: row === null };
}
