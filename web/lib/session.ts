// The signed-in owner, for pages and Server Actions. Server-only.
import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { session } from "@/db/schema";
import { getAuth, isOwnerUser } from "./auth";
import { PATH_HEADER, loginHref } from "./login";
import { ownerGithubId } from "./owner";

/** What the app needs to know about the signed-in owner. Nothing else leaves this module. */
export interface OwnerSession {
  userId: string;
  name: string;
  image: string | null;
}

/**
 * The owner's session, or null when signed out, expired, or signed in as anyone else. Reads the
 * request's cookies, so call it inside a <Suspense> boundary. Memoised per request.
 */
export const getOwnerSession = cache(async (): Promise<OwnerSession | null> => {
  // Read the request before anything else, even when the answer is already known: this makes
  // every caller request-time. An early return before it would let Next prerender the result
  // at build time (when OWNER_GITHUB_ID is usually unset) and serve it to everyone.
  const requestHeaders = await headers();
  const ownerId = ownerGithubId(process.env);
  if (!ownerId) return null;
  if (!getSessionCookie(requestHeaders)) return null;
  const auth = await getAuth();
  // Read-only: pages cannot set cookies, so a refresh here would extend the session in the
  // database but not in the browser. Renewal happens only in refreshSession() (app/actions/auth.ts),
  // which updates both together.
  const result = await auth.api.getSession({ headers: requestHeaders, query: { disableRefresh: true } });
  if (!result) return null;
  // Re-check the owner on every request: OWNER_GITHUB_ID may have changed since sign-in. A valid
  // session that fails the check is revoked, so changing the owner signs everyone else out.
  const db = await getDb();
  if (!(await isOwnerUser(db, result.user.id, ownerId))) {
    await db.delete(session).where(eq(session.id, result.session.id));
    return null;
  }
  return { userId: result.user.id, name: result.user.name, image: result.user.image ?? null };
});

/** The owner's session, or a redirect to /login (back to this page afterwards). */
export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getOwnerSession();
  if (owner) return owner;
  redirect(loginHref((await headers()).get(PATH_HEADER)));
}
