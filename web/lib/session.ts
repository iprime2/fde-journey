// The signed-in owner, for pages and Server Actions. Server-only.
import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
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
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;
  // Re-check the owner on every request: OWNER_GITHUB_ID may have changed since sign-in.
  if (!(await isOwnerUser(await getDb(), result.user.id, ownerId))) return null;
  return { userId: result.user.id, name: result.user.name, image: result.user.image ?? null };
});

/** The owner's session, or a redirect to /login (back to this page afterwards). */
export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getOwnerSession();
  if (owner) return owner;
  redirect(loginHref((await headers()).get(PATH_HEADER)));
}
