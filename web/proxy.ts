// Proxy (Next 16's name for middleware). Sends signed-out visitors to /login?next=… before any
// page renders, so they never see a flash of content. This is only the quick check (is there a
// session cookie at all?); pages, data reads and Server Actions verify the session and the
// owner themselves (lib/session.ts), as the Next.js docs recommend.
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { PATH_HEADER, isPublicPath, loginHref } from "@/lib/login";

/** Path and query without Next's internal `_rsc` cache-busting parameter. */
function requestedPath(request: NextRequest): string {
  const url = request.nextUrl.clone();
  url.searchParams.delete("_rsc");
  return `${url.pathname}${url.search}`;
}

export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  // Server Actions answer with a typed "signed-out" result instead of a redirect.
  if (request.headers.has("next-action")) return NextResponse.next();

  const path = requestedPath(request);
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL(loginHref(path), request.url));

  // Tell server code where the visitor was going, in case the session turns out to be invalid.
  const forwarded = new Headers(request.headers);
  forwarded.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  // Everything except Next's static files and files with an extension (favicon, images, fonts).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
