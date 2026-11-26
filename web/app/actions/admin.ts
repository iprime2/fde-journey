"use server";
// Admin actions for the /admin pages (M4-DESIGN 6). Each one is a thin wrapper: the work, the
// permission check (requirePermission, first, every time) and the audit row live in
// lib/admin-db.ts. Results are typed (lib/action-result.ts); a missing permission answers
// { code: "forbidden", message: "You no longer have permission to do this." }.
//
//   const result = await suspendUser(row.id);
//   if (!result.ok) showError(result.error.message);
import { revalidatePath } from "next/cache";
import type { Permission } from "@/lib/access-types";
import type { ActionResult } from "@/lib/action-result";
import * as adminDb from "@/lib/admin-db";
import { guarded } from "./guard";

/** Every admin page and the navigation counts can change after an admin action. */
function refreshed<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const read = <T,>(what: string, work: () => Promise<T>) => guarded(what, async () => ({ ok: true as const, value: await work() }));

/** users.manage. Signs them out at once; their data is kept. Not the owner, yourself, or (unless you're the owner) an admin. */
export async function suspendUser(userId: string): Promise<ActionResult<{ status: "suspended" }>> {
  return refreshed(await guarded("Suspending a user", () => adminDb.suspendUser(userId)));
}

/** users.manage. Back to a place if one is free, otherwise to the back of the waitlist. */
export async function reactivateUser(userId: string): Promise<ActionResult<{ status: "active" | "waitlisted" }>> {
  return refreshed(await guarded("Reactivating a user", () => adminDb.reactivateSuspendedUser(userId)));
}

/** waitlist.manage. One person from the waitlist ("no-place" when all places are taken). */
export async function letIn(userId: string): Promise<ActionResult<{ status: "active" }>> {
  return refreshed(await guarded("Letting someone in", () => adminDb.letInFromWaitlist(userId)));
}

/** waitlist.manage. The next `count` people in order, never past the cap. `admitted` can be lower than asked. */
export async function letInNext(count: number): Promise<ActionResult<{ admitted: number }>> {
  return refreshed(await guarded("Letting people in", () => adminDb.letInNextFromWaitlist(count)));
}

/** waitlist.manage. Deletes the waitlisted person's account. */
export async function removeFromWaitlist(userId: string): Promise<ActionResult<{ removed: true }>> {
  return refreshed(await guarded("Removing someone from the waitlist", () => adminDb.removeFromWaitlist(userId)));
}

/** settings.manage. 0 to 1,000. Raising it lets waitlisted people in, in order. */
export async function saveUserCap(cap: number): Promise<ActionResult<{ cap: number; previous: number; admitted: number }>> {
  return refreshed(await guarded("Saving the user cap", () => adminDb.setUserCap(cap)));
}

/** settings.manage. Sets or rotates the Scaler access code (stored hashed; never logged). */
export async function saveScalerAccessCode(code: string): Promise<ActionResult<{ set: true }>> {
  return refreshed(await guarded("Saving the Scaler access code", () => adminDb.setScalerAccessCode(code)));
}

/** admins.manage. "Add an admin" → Find. `value` is null when nobody has that GitHub username. */
export async function findUserForAdmin(githubLogin: string): Promise<ActionResult<adminDb.FoundPerson>> {
  return read("Finding a user", () => adminDb.findUserByGithubLogin(githubLogin));
}

/** admins.manage. Exactly these permissions; an empty list removes the person as an admin. */
export async function saveAdminPermissions(userId: string, permissions: Permission[]): Promise<ActionResult<{ permissions: Permission[] }>> {
  return refreshed(await guarded("Saving permissions", () => adminDb.setAdminPermissions(userId, permissions)));
}

/** admins.manage. Takes every admin permission away. */
export async function removeAdmin(userId: string): Promise<ActionResult<{ permissions: Permission[] }>> {
  return refreshed(await guarded("Removing an admin", () => adminDb.removeAdmin(userId)));
}

// "Show 50 more" on the admin lists. Same permissions as the pages.

/** users.view */
export async function loadMoreUsers(q: string, filter: adminDb.UserFilter, offset: number): Promise<ActionResult<adminDb.AdminUserPage>> {
  return read("Reading users", () => adminDb.listAdminUsers({ q, filter, offset }));
}

/** waitlist.manage */
export async function loadMoreWaitlist(offset: number): Promise<ActionResult<adminDb.WaitlistPage>> {
  return read("Reading the waitlist", () => adminDb.getWaitlistQueue({ offset }));
}

/** audit.view */
export async function loadMoreAudit(filter: string, offset: number): Promise<ActionResult<adminDb.AuditPage>> {
  return read("Reading the audit log", () => adminDb.listAuditLog({ filter, offset }));
}
