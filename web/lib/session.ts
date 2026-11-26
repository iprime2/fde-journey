// Who is signed in, for pages, Server Actions and route handlers. Server-only.
//
// requireUser() is the one way in for data: pages and Server Actions take the user's id from it,
// never from the request body, URL or a cookie value, and pass it to the data layer
// (lib/progress-db.ts, lib/settings-db.ts). requirePermission() is the one way into admin data
// (lib/admin-db.ts): it re-reads the user's status and permissions from the database every time.
//
// Sign-up mode (lib/signup-mode.ts):
// - owner-only (the default): only the owner has a usable session. A valid session of any other
//   account is revoked, as before M4b.
// - capped: active users use the app; waitlisted users only reach /waitlist and sign-out;
//   suspended users have no session (any left is revoked on sight).
import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { session } from "@/db/schema";
import { PERMISSIONS, type Permission, type UserStatus } from "./access-types";
import { loadAccess } from "./access";
import { getSessionReader } from "./auth";
import { PATH_HEADER, SUSPENDED_ERROR, loginHref } from "./login";
import { ownerGithubId } from "./owner";
import { withSafeErrors } from "./safe-log";
import { signupMode } from "./signup-mode";

/** What the app knows about the signed-in user. Nothing else about them leaves this module. */
export interface SessionUser {
  userId: string;
  name: string;
  image: string | null;
  /** GitHub username; null for an account that hasn't signed in since M4b (refreshed at sign-in). */
  githubLogin: string | null;
  /** Suspended users never get this far. */
  status: Exclude<UserStatus, "suspended">;
  /** The owner (OWNER_GITHUB_ID): every permission, never capped, can't be changed by anyone. */
  isSuperAdmin: boolean;
  /** Admin permissions. Every one for the super admin; none while waitlisted. */
  permissions: readonly Permission[];
}

type Resolved = { kind: "none" } | { kind: "suspended" } | { kind: "user"; user: SessionUser };

/**
 * The visitor's session, checked against the database. Reads the request's cookies, so call it
 * inside a <Suspense> boundary. Memoised per request.
 *
 * Throws a SafeError (names and codes only) when the check itself fails, never the database
 * error: that quotes the query's parameters, the session token among them.
 */
const resolveSession = cache(async (): Promise<Resolved> => {
  // Read the request before anything else, even when the answer is already known: this makes
  // every caller request-time. An early return before it would let Next prerender the result
  // at build time (when OWNER_GITHUB_ID is usually unset) and serve it to everyone.
  const requestHeaders = await headers();
  const ownerId = ownerGithubId(process.env);
  // Without OWNER_GITHUB_ID nobody can use the app: there would be no super admin.
  if (!ownerId) return { kind: "none" };
  if (!getSessionCookie(requestHeaders)) return { kind: "none" };
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
    if (!result) return { kind: "none" };
    const db = await getDb();
    // Re-checked on every request: the owner, the mode or the user's status may have changed.
    const access = await loadAccess(db, result.user.id, ownerId);
    const base = { userId: result.user.id, name: result.user.name, image: result.user.image ?? null, githubLogin: access?.githubLogin ?? null };
    if (access?.isOwner) return { kind: "user", user: { ...base, status: "active", isSuperAdmin: true, permissions: [...PERMISSIONS] } };
    if (!access || signupMode() === "owner-only") {
      // Owner-only: any other account's session is revoked, so changing the owner (or switching
      // back to owner-only) signs everyone else out.
      await db.delete(session).where(eq(session.id, result.session.id));
      return { kind: "none" };
    }
    if (access.status === "suspended") {
      // Suspending ends every session at once; one that survived (a race) ends here.
      await db.delete(session).where(eq(session.userId, result.user.id));
      return { kind: "suspended" };
    }
    const permissions = access.status === "active" ? access.permissions : [];
    return { kind: "user", user: { ...base, status: access.status, isSuperAdmin: false, permissions } };
  });
});

/**
 * The signed-in user, active or waitlisted, or null (signed out, suspended, or refused in
 * owner-only mode). For the account menu, the sign-in page and isReadOnly. Data access goes
 * through requireUser() instead.
 */
export const getIdentity = cache(async (): Promise<SessionUser | null> => {
  const resolved = await resolveSession();
  return resolved.kind === "user" ? resolved.user : null;
});

/** Thrown by requireUser({ onSignedOut: "throw" }): no usable session. Actions answer "signed-out". */
export class SignedOutError extends Error {
  constructor(message = "No signed-in user.") {
    super(message);
    this.name = "SignedOutError";
  }
}

/** A waitlisted user asked for something only active users may do. Actions treat it as signed out. */
export class WaitlistedError extends SignedOutError {
  constructor() {
    super("The user is on the waitlist.");
    this.name = "WaitlistedError";
  }
}

/** The user lacks an admin permission (or is the wrong kind of target). Actions answer "forbidden". */
export class PermissionError extends Error {
  constructor(message = "Not allowed.") {
    super(message);
    this.name = "PermissionError";
  }
}

interface RequireOptions {
  /** Pages: "redirect" (default). Server Actions and route handlers: "throw". */
  onSignedOut?: "redirect" | "throw";
  /** Only /waitlist and leaving it accept waitlisted users. Everything else refuses them. */
  allowWaitlisted?: boolean;
}

/**
 * The signed-in user, from the server-side session only.
 *
 * - Pages (default, `onSignedOut: "redirect"`): signed out goes to /login (back to this page
 *   afterwards), suspended to /login?error=suspended, waitlisted to /waitlist.
 * - Server Actions (`onSignedOut: "throw"`): throws SignedOutError (WaitlistedError for the
 *   waitlist). A redirect from an action would take the user away from the page and the note they
 *   were typing; the action answers "signed-out" instead (app/actions/progress.ts).
 */
export async function requireUser({ onSignedOut = "redirect", allowWaitlisted = false }: RequireOptions = {}): Promise<SessionUser> {
  const resolved = await resolveSession();
  if (resolved.kind === "user" && (resolved.user.status === "active" || allowWaitlisted)) return resolved.user;
  if (onSignedOut === "throw") {
    if (resolved.kind === "user") throw new WaitlistedError();
    throw new SignedOutError();
  }
  if (resolved.kind === "user") redirect("/waitlist");
  if (resolved.kind === "suspended") redirect(`/login?error=${SUSPENDED_ERROR}`);
  redirect(loginHref((await headers()).get(PATH_HEADER)));
}

/** Who is acting on an admin page or action, with the permissions read just now. */
export interface AdminActor {
  userId: string;
  isSuperAdmin: boolean;
  permissions: readonly Permission[];
}

/**
 * An active user holding `permission`, checked against the database on every call (a permission
 * taken away a second ago no longer works). The super admin holds every permission.
 *
 * - `onDenied: "throw"` (default; Server Actions and lib/admin-db.ts): SignedOutError when signed
 *   out or waitlisted, PermissionError without the permission.
 * - `onDenied: "not-found"` (admin pages): redirects as requireUser does, and shows the not-found
 *   page without the permission (a plain "forbidden" would confirm the page exists).
 */
export async function requirePermission(permission: Permission, { onDenied = "throw" }: { onDenied?: "throw" | "not-found" } = {}): Promise<AdminActor> {
  const me = await requireUser({ onSignedOut: onDenied === "throw" ? "throw" : "redirect" });
  const access = await withSafeErrors("Permission check", async () => loadAccess(await getDb(), me.userId, ownerGithubId(process.env)));
  const allowed = !!access && (access.isOwner || (access.status === "active" && access.permissions.includes(permission)));
  if (!allowed || !access) {
    if (onDenied === "not-found") notFound();
    throw new PermissionError();
  }
  return { userId: me.userId, isSuperAdmin: access.isOwner, permissions: access.permissions };
}
