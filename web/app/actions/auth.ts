"use server";
// Sign-in and sign-out for the front end.
//
// Sign-in:  <form action={signInWithGitHub}><input type="hidden" name="next" value={next} />…</form>
//           Sends the browser to GitHub. Afterwards Better Auth returns it to `next`, or to
//           /login?next=…&error=… when sign-in fails ("not_owner" for another account).
// Sign-out: <form action={signOut}>…</form>. Ends the session, then opens /login?status=signed-out.
// Renewal: `await refreshSession()` from a client component, at most once a day. Returns { ok }.
//
// Sign-in and sign-out need no user check: sign-in is how a user proves who they are (the
// sign-up rules run inside Better Auth, see lib/auth.ts), and sign-out only ends the caller's own
// session. refreshSession checks the session first.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { SIGNED_OUT_STATUS, loginHref, safeNextPath } from "@/lib/login";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";

export async function signInWithGitHub(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const back = loginHref(next);
  let url: string;
  try {
    const auth = await getAuth();
    const result = await auth.api.signInSocial({
      body: { provider: "github", callbackURL: next, errorCallbackURL: back, disableRedirect: true },
      headers: await headers(),
    });
    if (!result?.url) throw new Error("no redirect URL");
    url = result.url;
  } catch {
    // GitHub not configured or unreachable: show "Sign-in didn't finish. Try again."
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=unavailable`);
  }
  redirect(url);
}

export async function signOut(): Promise<void> {
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // The database is unreachable, say: still leave the app (the cookie is cleared or expires).
    rethrowNextControl(error);
    console.error(`Sign-out failed (${describeError(error)})`);
  }
  redirect(`/login?status=${SIGNED_OUT_STATUS}`);
}

/**
 * Keeps the user signed in while they use the app. Pages cannot set cookies, so they never renew
 * the session; this Server Action can. When the session is due (a day after it was last renewed)
 * Better Auth extends it to 30 days from now in the database and in the cookie together; otherwise
 * nothing changes. Returns { ok: false } and does nothing when signed out, suspended, or (in
 * owner-only mode) for any account but the owner's (whose session getIdentity revokes). Waitlisted
 * users stay signed in too: they may come back to see their place.
 */
export async function refreshSession(): Promise<{ ok: boolean }> {
  try {
    if (!(await getIdentity())) return { ok: false };
    const auth = await getAuth();
    const result = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
    return { ok: result !== null };
  } catch (error) {
    rethrowNextControl(error);
    console.error(`Session renewal failed (${describeError(error)})`);
    return { ok: false };
  }
}
