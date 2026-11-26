"use server";
// Sign-in and sign-out for the front end.
//
// Sign-in:  <form action={signInWithGitHub}><input type="hidden" name="next" value={next} />…</form>
//           Sends the browser to GitHub. Afterwards Better Auth returns it to `next`, or to
//           /login?next=…&error=… when sign-in fails ("not_owner" for another account).
// Sign-out: <form action={signOut}>…</form>. Ends the session, then opens /login?status=signed-out.
//
// Neither needs the owner check: sign-in is how the owner proves who they are (the owner rule
// runs inside Better Auth, see lib/auth.ts), and sign-out only ends the caller's own session.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { SIGNED_OUT_STATUS, loginHref, safeNextPath } from "@/lib/login";

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
  } catch {
    // No session (already signed out) or the database is unreachable: still leave the app.
  }
  redirect(`/login?status=${SIGNED_OUT_STATUS}`);
}
