// Proxy (Next 16's name for middleware; it runs on the Node.js runtime, the only one Next 16
// allows here). Decides where a visitor may go before any page renders, so nobody sees a flash of
// a page they can't use:
// - signed out (no session cookie): /login?next=…, with no database work;
// - with a session cookie: the user's status, read in one indexed query (lib/session-gate.ts),
//   decides (lib/landing.ts). Waitlisted users go to /waitlist, suspended users to
//   /login?error=suspended, a dead or refused session to /login; active users and the owner pass.
//   /waitlist itself takes waitlisted users only (active users go Home).
// - Server Actions: a waitlisted or suspended user's are refused (403, no body) everywhere but on
//   /waitlist, where leaving the waitlist and signing out live. Signed-out callers pass, so the
//   action answers with its typed "signed-out" result.
//
// Cost: one query per gated request, prefetches included. Prefetches are not skipped: Next strips
// the prefetch headers before the proxy sees them, and a prefetched app shell kept for a waitlisted
// user (a link on /privacy, say) would show on the next click. Public paths, signed-out requests
// and static files never query.
//
// Pages, data reads and Server Actions still verify the session and the user themselves
// (lib/session.ts), as the Next.js docs recommend: this is the first check, not the only one.
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { WAITLIST_PATH, gateTarget, pagePathname } from "@/lib/landing";
import { PATH_HEADER, isPublicPath, loginHref } from "@/lib/login";
import { describeError } from "@/lib/safe-log";
import { checkSessionCookie } from "@/lib/session-gate";

/** Better Auth's session cookie, by its name over http and over https (production). */
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"] as const;

/** The page's path and query, without Next's internal `_rsc` cache-busting parameter. */
function requestedPath(request: NextRequest): string {
  const url = request.nextUrl.clone();
  url.searchParams.delete("_rsc");
  return `${pagePathname(url.pathname)}${url.search}`;
}

/** A Server Action call: always a POST with Next's `next-action` header. */
function isServerAction(request: NextRequest): boolean {
  return request.method === "POST" && request.headers.has("next-action");
}

/** Passes the request on with the given headers (Next forwards them instead of the browser's). */
const forward = (headers: Headers) => NextResponse.next({ request: { headers } });

/** A redirect that no cache keeps: the answer depends on who is asking, and can change any time. */
function redirectTo(target: string, request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL(target, request.url));
  response.headers.set("cache-control", "no-store");
  return response;
}

/**
 * Expires the session cookie in the browser, under both names. Used when the cookie names no live
 * session: /login would otherwise still see it, and if Better Auth ever judged it differently the
 * two could send the browser back and forth.
 */
function expireSessionCookies(response: NextResponse): NextResponse {
  for (const name of SESSION_COOKIES) {
    response.cookies.set({ name, value: "", maxAge: 0, path: "/", httpOnly: true, sameSite: "lax", secure: name.startsWith("__Secure-") });
  }
  return response;
}

/** No body, never cached: for Server Actions, whose callers read the status only. */
const bare = (status: number) => new NextResponse(null, { status, headers: { "cache-control": "no-store" } });

/** The page shown when the status check fails: no app frame, no details, a way to try again. */
const UNAVAILABLE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="color-scheme" content="light dark"><title>FDE Journey</title></head>' +
  "<body><main><p>FDE Journey can&#39;t check your sign-in right now.</p>" +
  '<p><a href="">Try again</a></p></main></body></html>';

/**
 * The status check failed (the database didn't answer twice, or the auth secret is missing):
 * refuse rather than let the page's static frame through to someone who may not be allowed in.
 * The log has error names and codes only.
 */
function unavailable(error: unknown, action: boolean): NextResponse {
  console.error(`Proxy: session status check failed (${describeError(error)})`);
  if (action) return bare(503);
  return new NextResponse(UNAVAILABLE_HTML, {
    status: 503,
    headers: { "cache-control": "no-store", "content-type": "text/html; charset=utf-8", "retry-after": "30" },
  });
}

export async function proxy(request: NextRequest) {
  // Only this proxy sets the path header: drop any copy the browser sent, on every request.
  const headers = new Headers(request.headers);
  headers.delete(PATH_HEADER);

  const pathname = pagePathname(request.nextUrl.pathname);
  if (isPublicPath(pathname)) return forward(headers);
  const cookie = getSessionCookie(request);

  if (isServerAction(request)) {
    // Signed out: the action answers with its typed "signed-out" result. On /waitlist every
    // action is allowed (leave the waitlist, sign out); the actions check the user themselves.
    if (!cookie || pathname === WAITLIST_PATH) return forward(headers);
    try {
      const { standing } = await checkSessionCookie(cookie);
      return standing === "waitlisted" || standing === "suspended" ? bare(403) : forward(headers);
    } catch (error) {
      return unavailable(error, true);
    }
  }

  const path = requestedPath(request);
  if (!cookie) return redirectTo(loginHref(path), request);

  let target: string | null;
  let clearCookie = false;
  try {
    const check = await checkSessionCookie(cookie);
    target = gateTarget(check.standing, pathname, path);
    clearCookie = check.standing === "signed-out" && check.clearCookie;
  } catch (error) {
    return unavailable(error, false);
  }
  if (target) {
    const response = redirectTo(target, request);
    return clearCookie ? expireSessionCookies(response) : response;
  }

  // Tell server code where the visitor was going, in case the session turns out to be invalid.
  headers.set(PATH_HEADER, path);
  return forward(headers);
}

export const config = {
  // Everything except Next's static files, its image optimiser, and real static file types (icons,
  // images, fonts, styles, scripts). Not "anything with a dot": Next's page payloads (/roadmap.rsc,
  // /roadmap.segments/…) have one, and must be gated like the page.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|png|svg|jpe?g|webp|gif|txt|xml|webmanifest|woff2?|css|js|map)$).*)"],
};
