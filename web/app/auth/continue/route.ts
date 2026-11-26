// GET /auth/continue?next=/path: where GitHub sign-in returns the browser (the sign-in action's
// callbackURL, app/actions/auth.ts). It answers with a redirect and never with HTML, chosen on the
// server from the session and the user's status read just now (lib/landing.ts):
// - active (and the owner, always): the page they wanted, `next`, checked by safeNextPath;
// - waitlisted: /waitlist;
// - suspended: /login?error=suspended (their sessions are ended, as on any page);
// - no usable session: /login (owner-only mode included: any other account's session is revoked).
// So a new user past the cap goes straight to /waitlist and never sees the app's frame.
//
// It reads the request (cookies, query), so it always runs at request time; `no-store` keeps any
// cache from keeping the answer. The proxy lets it through untouched (lib/login.ts, isPublicPath).
// Failures are logged as names and codes only, never the session token or the database error.
import { type NextRequest, NextResponse } from "next/server";
import { continueTarget } from "@/lib/landing";
import { loginHref, safeNextPath } from "@/lib/login";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { sessionStanding } from "@/lib/session";

/** The sign-in page with "Sign-in didn't finish. Try again.", keeping `next` (as the sign-in action does). */
function unavailable(next: string): string {
  const back = loginHref(next);
  return `${back}${back.includes("?") ? "&" : "?"}error=unavailable`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  let target: string;
  try {
    target = continueTarget(await sessionStanding(request.headers), next);
  } catch (error) {
    rethrowNextControl(error);
    console.error(`After sign-in: session check failed (${describeError(error)})`);
    target = unavailable(next);
  }
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.headers.set("cache-control", "no-store");
  return response;
}
