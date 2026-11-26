// Sign-in addresses and the `next` parameter. Safe to import anywhere (no server code).

/** Header the proxy sets on page requests so server code knows where the visitor was going. */
export const PATH_HEADER = "x-fde-path";

/**
 * Where GitHub sign-in returns the browser (app/auth/continue/route.ts). It answers with a redirect
 * only, chosen on the server from the user's status, so nobody sees a page they can't use.
 */
export const CONTINUE_PATH = "/auth/continue";

const ORIGIN = "https://app.invalid";

/**
 * Returns `value` if it is a path on this site, otherwise "/". Blocks open redirects: absolute
 * URLs, protocol-relative ("//host"), backslash tricks ("/\host"), control characters, and
 * anything that would leave the site once parsed. Also refuses /login (a loop), /api/ paths and
 * /auth/ paths (the post-sign-in route, which would only nest itself).
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGIN) return "/";
  const path = url.pathname;
  if (["/login", "/api", "/auth"].some((p) => path === p || path.startsWith(`${p}/`))) return "/";
  const out = `${path}${url.search}${url.hash}`;
  // Parsing removes dot segments, so "/.//host" or "/a/..//host" comes back as "//host", which a
  // browser reads as another site. Check the result again, not only the input.
  if (out.startsWith("//") || out.includes("\\")) return "/";
  return out;
}

/** The sign-in page, remembering where to go afterwards. */
export function loginHref(next: unknown): string {
  const path = safeNextPath(next);
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
}

/** The post-sign-in route, carrying where to go afterwards (already checked by safeNextPath). */
export function continueHref(next: unknown): string {
  const path = safeNextPath(next);
  return path === "/" ? CONTINUE_PATH : `${CONTINUE_PATH}?next=${encodeURIComponent(path)}`;
}

/** Query value `/login?status=signed-out` set by the sign-out action. */
export const SIGNED_OUT_STATUS = "signed-out";
/** `/login?status=deleted`, after "Delete my account". */
export const DELETED_STATUS = "deleted";
/** `/login?status=left-waitlist`, after "Leave the waitlist". */
export const LEFT_WAITLIST_STATUS = "left-waitlist";
/** Error code for a GitHub account that is not the owner's (Better Auth adds it as `?error=`). */
export const NOT_OWNER_ERROR = "not_owner";
/** Error code for a suspended account (capped mode): from sign-in, or a session that was ended. */
export const SUSPENDED_ERROR = "suspended";

/** Which message the sign-in page shows (design spec section 8). */
export type LoginNotice = "not-owner" | "failed" | "signed-out" | "suspended" | "deleted" | "left-waitlist" | null;

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_NOTICES: Record<string, LoginNotice> = {
  [SIGNED_OUT_STATUS]: "signed-out",
  [DELETED_STATUS]: "deleted",
  [LEFT_WAITLIST_STATUS]: "left-waitlist",
};

/** Reads the sign-in page's query: where to go after sign-in, and which message to show. */
export function parseLoginParams(params: Params): { next: string; notice: LoginNotice } {
  const next = safeNextPath(first(params.next));
  const error = first(params.error);
  if (error) {
    if (error === NOT_OWNER_ERROR) return { next, notice: "not-owner" };
    if (error === SUSPENDED_ERROR) return { next, notice: "suspended" };
    return { next, notice: "failed" };
  }
  const status = first(params.status);
  return { next, notice: (status && Object.hasOwn(STATUS_NOTICES, status) ? STATUS_NOTICES[status] : null) ?? null };
}

/**
 * Who may sign in (design spec 8). Only the access line and the not-allowed error depend on it.
 * The sign-in page reads the mode at request time from SIGNUP_MODE (lib/signup-mode.ts, which
 * returns "owner-only" or "capped"), the same setting that decides who really gets in: ownerGate
 * and isOwnerUser in owner-only mode, the cap and the user's status in capped mode (lib/auth.ts,
 * lib/places.ts, lib/session.ts). "open" has copy but no server mode yet.
 */
export type AccessMode = "owner-only" | "capped" | "open";

/** Everything on the sign-in page that depends on the access mode. */
export const ACCESS_COPY: Record<AccessMode, { access: string; notAllowed: string | null }> = {
  "owner-only": {
    access: "Private for now: only the owner's GitHub account can sign in.",
    notAllowed: "This GitHub account can't sign in. FDE Journey is private to its owner for now.",
  },
  capped: {
    access: "New here? Continue with GitHub to start your own tracker. Places are limited; if they're full you'll join the waitlist.",
    notAllowed: null,
  },
  open: {
    access: "New here? Continue with GitHub to start your own tracker.",
    notAllowed: null,
  },
};

/** The suspended notice (design spec 8). The front end adds the "Open an issue" link after it. */
export const SUSPENDED_MESSAGE = "This account is suspended, so it can't sign in. If you think this is a mistake, open an issue on GitHub.";

/**
 * The banner above the sign-in button for a notice, or null for none (design spec 5 and 8). `mode`
 * is the sign-up mode now (signupMode()); only the not-allowed error depends on it.
 */
export function loginMessage(notice: LoginNotice, mode: AccessMode): { tone: "error" | "info"; text: string } | null {
  switch (notice) {
    case "not-owner": {
      // With open sign-up nobody is turned away; if the code still arrives, treat it as a failure.
      const text = ACCESS_COPY[mode].notAllowed ?? "Sign-in didn't finish. Try again.";
      return { tone: "error", text };
    }
    case "failed":
      return { tone: "error", text: "Sign-in didn't finish. Try again." };
    case "signed-out":
      return { tone: "info", text: "You're signed out." };
    case "suspended":
      return { tone: "error", text: SUSPENDED_MESSAGE };
    case "deleted":
      return { tone: "info", text: "Your account and data are deleted." };
    case "left-waitlist":
      return { tone: "info", text: "You've left the waitlist and your account is deleted." };
    default:
      return null;
  }
}

/**
 * Paths the proxy lets through without a session cookie or a status check. /privacy is public;
 * /api/export checks its own bearer key (app/api/export/route.ts); the post-sign-in route checks
 * the session itself and only ever redirects. Everything else needs a sign-in.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === CONTINUE_PATH ||
    pathname === "/api/export" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/")
  );
}
