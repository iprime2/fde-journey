// Where a signed-in visitor may go, decided before any HTML of the app is sent. Pure functions,
// shared by the proxy (proxy.ts, every page request), the post-sign-in route
// (app/auth/continue/route.ts) and their tests. Safe to import anywhere.
//
// The rule (M4b): active users and the owner use the app; waitlisted users only reach /waitlist
// (and the public pages); suspended users and anyone without a usable session go to /login. The
// pages check again themselves (lib/session.ts, requireUser), as defence in depth.
import { SUSPENDED_ERROR, loginHref, safeNextPath } from "./login";
import type { SignupMode } from "./signup-mode";

/** What a visitor may do, from their session and status as read just now. */
export type Standing = "signed-out" | "active" | "waitlisted" | "suspended";

export const WAITLIST_PATH = "/waitlist";
/** The sign-in page with the suspended notice (design spec 8). */
export const SUSPENDED_HREF = `/login?error=${SUSPENDED_ERROR}`;

/** A session's user as one query reads it (lib/session-gate.ts). Null: no live session. */
export interface SessionStatusRow {
  status: unknown;
  isOwner: boolean;
}

/**
 * The visitor's standing:
 * - the owner (OWNER_GITHUB_ID) is always active, whatever their stored status says;
 * - in owner-only mode nobody else has a usable session (lib/session.ts revokes it);
 * - otherwise the stored status. A value the app doesn't know counts as signed out, which sends
 *   them to /login (never to /waitlist, whose page would send them back: a loop).
 */
export function standingOf(row: SessionStatusRow | null, mode: SignupMode): Standing {
  if (!row) return "signed-out";
  if (row.isOwner) return "active";
  if (mode === "owner-only") return "signed-out";
  if (row.status === "active" || row.status === "waitlisted" || row.status === "suspended") return row.status;
  return "signed-out";
}

/**
 * The proxy's answer for a page request: where to send the visitor, or null to let the request
 * through. `pathname` is the requested path; `path` adds its query (kept for /login?next=…).
 *
 * /waitlist is the one page with the opposite rule: waitlisted users stay, active users go Home
 * (so a reload after "Let in" opens the app). No standing is sent somewhere that sends it back.
 */
export function gateTarget(standing: Standing, pathname: string, path: string): string | null {
  if (standing === "suspended") return SUSPENDED_HREF;
  if (standing === "signed-out") return loginHref(path);
  if (pathname === WAITLIST_PATH) return standing === "active" ? "/" : null;
  return standing === "waitlisted" ? WAITLIST_PATH : null;
}

/** Where the post-sign-in route sends the browser. `next` is checked again here (open redirects). */
export function continueTarget(standing: Standing, next: unknown): string {
  switch (standing) {
    case "active":
      return safeNextPath(next);
    case "waitlisted":
      return WAITLIST_PATH;
    case "suspended":
      return SUSPENDED_HREF;
    default:
      return loginHref(next);
  }
}
