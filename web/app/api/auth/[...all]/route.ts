// Better Auth's endpoints: GitHub sign-in and callback, get-session, sign-out. Endpoints the app
// does not use answer 404 (lib/auth.ts). The owner rule runs inside Better Auth before any user
// or session is stored.
//
// Better Auth answers its own errors (redirects, APIError responses). Anything else (a database
// failure mid-sign-in, for one) is thrown out of auth.handler (`onAPIError.throw`, lib/auth.ts)
// and handled here: logged as names and codes only, never the error itself, whose message
// quotes the failed query's parameters (the new session token, user id, IP address, browser).
import { getAuth } from "@/lib/auth";
import { describeError, rethrowNextControl } from "@/lib/safe-log";

/** GitHub sends the browser back to /api/auth/callback/github after sign-in. */
const CALLBACK_PATH = /^\/api\/auth\/callback\//;

/** Any `?error=` other than "not_owner" makes /login say "Sign-in didn't finish. Try again." */
const CALLBACK_FAILED = "/login?error=server_error";

async function handler(request: Request): Promise<Response> {
  try {
    const auth = await getAuth();
    return await auth.handler(request);
  } catch (error) {
    rethrowNextControl(error);
    console.error(`Auth route failed (${describeError(error)})`);
    const headers = { "cache-control": "no-store" };
    // A failed GitHub callback is a page the browser is showing: send it to the sign-in page.
    if (request.method === "GET" && CALLBACK_PATH.test(new URL(request.url).pathname)) {
      return new Response(null, { status: 302, headers: { ...headers, location: CALLBACK_FAILED } });
    }
    return new Response(null, { status: 500, headers });
  }
}

export { handler as GET, handler as POST };
