// The proxy's status check (proxy.ts): from the session cookie to the visitor's standing, in one
// database query, before any page renders. Server-only.
//
// Cost: one indexed query per gated request (every page visit, client navigation and prefetch of
// an app page by a visitor with a session cookie; Server Actions and public paths are skipped).
// The session token is unique (session_token_unique) and the owner test reads account by user id
// (account_userId_idx), so it is two index lookups. On Neon over HTTP that is one HTTPS round trip;
// on PGlite an in-process call. Nothing is cached: a status changed a second ago (the owner lets
// someone in, or suspends them) counts on the very next request.
//
// It never writes: ending a refused session stays with lib/session.ts, which runs on the page the
// visitor is sent to (/login revokes a suspended user's sessions, as before).
//
// The session token never leaves this module: not in logs, not in errors (withSafeErrors keeps
// error names and codes only, never the query's parameters).
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { type Db, getDb } from "@/db/client";
import { session, user } from "@/db/schema";
import { type Standing, standingOf } from "./landing";
import { ownerGithubId } from "./owner";
import { withSafeErrors } from "./safe-log";
import { signupMode } from "./signup-mode";

type Env = Record<string, string | undefined>;

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

/** The live session's user status and owner flag, in one query. Null when there is no live session. */
export async function readSessionStatus(db: Db, token: string, ownerId: string): Promise<{ status: unknown; isOwner: boolean } | null> {
  const rows = await db
    .select({
      status: user.status,
      // Written out in full ("user"."id"), as in lib/access.ts: the sub-query has its own table.
      isOwner: sql<boolean>`exists (select 1 from "account" a where a."user_id" = "user"."id" and a."provider_id" = 'github' and a."account_id" = ${ownerId})`,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.token, token), gt(session.expiresAt, sql`now()`)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { status: row.status, isOwner: row.isOwner === true || (row.isOwner as unknown) === "t" };
}

/**
 * The visitor's standing from their session cookie value (getSessionCookie). Signed out without
 * OWNER_GITHUB_ID (nobody can use the app then), without a cookie, or with a forged one (no query).
 *
 * Throws a SafeError (names and codes only) when the database can't answer, and a plain Error when
 * BETTER_AUTH_SECRET is missing. The proxy refuses the request then (fails closed).
 */
export async function standingFromCookie(cookieValue: string | null, env: Env = process.env, db: () => Promise<Db> = getDb): Promise<Standing> {
  const ownerId = ownerGithubId(env);
  if (!ownerId || !cookieValue) return "signed-out";
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  const token = verifiedSessionToken(cookieValue, secret);
  if (!token) return "signed-out";
  const row = await withSafeErrors("Session status check", async () => readSessionStatus(await db(), token, ownerId));
  return standingOf(row, signupMode(env));
}
