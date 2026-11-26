// Who is signed in, for pages and Server Actions. Server-only.
//
// requireUser() is the one way in for data: pages and Server Actions take the user's id from it,
// never from the request body, URL or a cookie value, and pass it to lib/progress-db.ts. In M4a
// it builds on getOwnerSession (owner-only, revoking other accounts); M4b relaxes the gate.
import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { session } from "@/db/schema";
import { getSessionReader, isOwnerUser } from "./auth";
import { PATH_HEADER, loginHref } from "./login";
import { ownerGithubId } from "./owner";
import { withSafeErrors } from "./safe-log";

/** What the app needs to know about the signed-in owner. Nothing else leaves this module. */
export interface OwnerSession {
  userId: string;
  name: string;
  image: string | null;
}

/**
 * The owner's session, or null when signed out, expired, or signed in as anyone else. Reads the
 * request's cookies, so call it inside a <Suspense> boundary. Memoised per request.
 *
 * Throws a SafeError (names and codes only) when the check itself fails, never the database
 * error: that quotes the query's parameters, the session token among them.
 */
export const getOwnerSession = cache(async (): Promise<OwnerSession | null> => {
  // Read the request before anything else, even when the answer is already known: this makes
  // every caller request-time. An early return before it would let Next prerender the result
  // at build time (when OWNER_GITHUB_ID is usually unset) and serve it to everyone.
  const requestHeaders = await headers();
  const ownerId = ownerGithubId(process.env);
  if (!ownerId) return null;
  if (!getSessionCookie(requestHeaders)) return null;
  // No database work in any prerender. Next also prerenders at request time (the App Shell a
  // <Link> prefetches, the `.rsc` requests): headers() resolves there, but Next ends that
  // prerender while the session query is still in flight and makes its fetch reject. Better Auth
  // caught that rejection, logged the query with the session token, and turned it into a
  // "session check failed". connection() waits for a real request instead: in a prerender it
  // never resolves, so the query never starts and the session parts stay behind their
  // <Suspense> fallbacks, as before.
  await connection();
  return withSafeErrors("Session check", async () => {
    // Read-only, in the database and in the browser. Pages cannot set cookies, so a refresh here
    // would extend the session in the database but not in the browser: renewal happens only in
    // refreshSession() (app/actions/auth.ts), which updates both together. And the reader never
    // deletes the cookie of an ended session, which in a Server Action would make Next re-render
    // the page and leave it for /login (see getSessionReader).
    const auth = await getSessionReader();
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
});

/** Thrown by requireUser({ onSignedOut: "throw" }): no signed-in user. Server Actions turn it into a "signed-out" result. */
export class SignedOutError extends Error {
  constructor() {
    super("No signed-in user.");
    this.name = "SignedOutError";
  }
}

/**
 * The signed-in user's id, from the server-side session only.
 *
 * - Pages (default, `onSignedOut: "redirect"`): otherwise redirects to /login, back to this page.
 * - Server Actions (`onSignedOut: "throw"`): otherwise throws SignedOutError. A redirect from an
 *   action would take the user away from the page and the note they were typing; the action
 *   answers "signed-out" instead (app/actions/progress.ts).
 *
 * M4a: only the owner has a user (getOwnerSession). M4b lets other active users in here.
 */
export async function requireUser({ onSignedOut = "redirect" }: { onSignedOut?: "redirect" | "throw" } = {}): Promise<string> {
  const owner = await getOwnerSession();
  if (owner) return owner.userId;
  if (onSignedOut === "throw") throw new SignedOutError();
  redirect(loginHref((await headers()).get(PATH_HEADER)));
}
