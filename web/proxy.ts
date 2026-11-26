// Proxy (Next 16's name for middleware; it runs on the Node.js runtime, the only one Next 16
// allows here). Decides where a visitor may go before any page renders, so nobody sees a flash of
// a page they can't use:
// - signed out (no session cookie): /login?next=…, with no database work;
// - with a session cookie: the user's status, read in one indexed query (lib/session-gate.ts),
//   decides (lib/landing.ts). Waitlisted users go to /waitlist, suspended users to
//   /login?error=suspended, a dead or refused session to /login; active users and the owner pass.
//   /waitlist itself takes waitlisted users only (active users go Home).
//
// Cost: one query per gated request, prefetches included. Prefetches are not skipped: Next strips
// the prefetch headers before the proxy sees them, and a prefetched app shell kept for a waitlisted
// user (a link on /privacy, say) would show on the next click. Public paths, Server Actions (which
// answer with a typed "signed-out" result instead) and Next's static files never query.
//
// Pages, data reads and Server Actions still verify the session and the user themselves
// (lib/session.ts), as the Next.js docs recommend: this is the first check, not the only one.
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { gateTarget } from "@/lib/landing";
import { PATH_HEADER, isPublicPath, loginHref } from "@/lib/login";
import { describeError } from "@/lib/safe-log";
import { standingFromCookie } from "@/lib/session-gate";

/** Path and query without Next's internal `_rsc` cache-busting parameter. */
function requestedPath(request: NextRequest): string {
  const url = request.nextUrl.clone();
  url.searchParams.delete("_rsc");
  return `${url.pathname}${url.search}`;
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
 * The status check failed (the database is unreachable): refuse rather than let the page's static
 * frame through to someone who may not be allowed in. No details: the log has names and codes only.
 */
function unavailable(): NextResponse {
  return new NextResponse("FDE Journey can't check your sign-in right now. Try again in a minute.", {
    status: 503,
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8", "retry-after": "30" },
  });
}

export async function proxy(request: NextRequest) {
  // Only this proxy sets the path header: drop any copy the browser sent, on every request.
  const headers = new Headers(request.headers);
  headers.delete(PATH_HEADER);

  if (isPublicPath(request.nextUrl.pathname)) return forward(headers);
  // Server Actions answer with a typed "signed-out" result instead of a redirect.
  if (isServerAction(request)) return forward(headers);

  const path = requestedPath(request);
  const cookie = getSessionCookie(request);
  if (!cookie) return redirectTo(loginHref(path), request);

  let target: string | null;
  try {
    target = gateTarget(await standingFromCookie(cookie), request.nextUrl.pathname, path);
  } catch (error) {
    console.error(`Proxy: session status check failed (${describeError(error)})`);
    return unavailable();
  }
  if (target) return redirectTo(target, request);

  // Tell server code where the visitor was going, in case the session turns out to be invalid.
  headers.set(PATH_HEADER, path);
  return forward(headers);
}

export const config = {
  // Everything except Next's static files and files with an extension (favicon, images, fonts).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
