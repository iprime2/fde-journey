"use server";
// Leaving: "Delete my account" (Settings) and "Leave the waitlist" (/waitlist). Each deletes the
// signed-in user only (the id comes from the session), with everything that is theirs, ends the
// session and goes to /login with a notice. Failures return a typed result and change nothing.
//
//   const result = await deleteMyAccount(typedUsername); // on success the browser goes to /login?status=deleted
//   if (!result.ok) showFieldError(result.error.message);
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { type ActionResult, fail, invalid, ok } from "@/lib/action-result";
import { getAuth } from "@/lib/auth";
import { DELETED_STATUS, LEFT_WAITLIST_STATUS } from "@/lib/login";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { requireUser } from "@/lib/session";
import { deleteUserAccount } from "@/lib/settings";
import { guarded } from "./guard";

/** Clears the session cookie (the session row went with the user). Never blocks leaving. */
async function endSession(): Promise<void> {
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    rethrowNextControl(error);
    console.error(`Sign-out after deleting an account failed (${describeError(error)})`);
  }
}

/**
 * Deletes the signed-in user's account, confirmed by typing their GitHub username (trimmed, any
 * case). Not for the owner. On success it redirects to /login?status=deleted.
 */
export async function deleteMyAccount(confirmUsername: string): Promise<ActionResult<never>> {
  const result = await guarded("Deleting an account", async (): Promise<ActionResult<true>> => {
    const me = await requireUser({ onSignedOut: "throw" });
    if (me.isSuperAdmin) return fail({ code: "forbidden", message: "The owner's account can't be deleted here." });
    const typed = typeof confirmUsername === "string" ? confirmUsername.trim().replace(/^@/, "") : "";
    if (!typed) return invalid("Type your GitHub username to confirm.", "confirm");
    if (!me.githubLogin) return invalid("Sign out and sign in again, then try again.", "confirm");
    if (typed.toLowerCase() !== me.githubLogin.toLowerCase()) return invalid(`That doesn't match your username. Type ${me.githubLogin}.`, "confirm");
    if (!(await deleteUserAccount(await getDb(), me.userId, null))) return fail({ code: "failed", message: "Couldn't delete your account. Nothing was deleted. Try again." });
    return ok(true);
  });
  if (!result.ok) return result;
  await endSession();
  redirect(`/login?status=${DELETED_STATUS}`);
}

/** Leaves the waitlist: deletes the waitlisted user's account. On success it redirects to /login?status=left-waitlist. */
export async function leaveWaitlist(): Promise<ActionResult<never>> {
  const result = await guarded("Leaving the waitlist", async (): Promise<ActionResult<true>> => {
    const me = await requireUser({ onSignedOut: "throw", allowWaitlisted: true });
    if (me.status !== "waitlisted" || me.isSuperAdmin) return fail({ code: "forbidden", message: "You already have a place." });
    if (!(await deleteUserAccount(await getDb(), me.userId, "waitlisted"))) {
      return fail({ code: "failed", message: "Couldn't leave the waitlist. Check your connection and try again." });
    }
    return ok(true);
  });
  if (!result.ok) return result;
  await endSession();
  redirect(`/login?status=${LEFT_WAITLIST_STATUS}`);
}
