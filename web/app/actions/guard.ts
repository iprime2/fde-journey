// Shared error handling for the M4b Server Actions (settings, account, admin). Not an action file
// itself ("use server" files may only export actions).
//
// The action's own work checks the session and permission first (requireUser, requirePermission).
// Here a refused session becomes "signed-out", a missing permission "forbidden", and anything else
// "failed", logged as names and codes only: database errors quote the query's parameters.
import { type ActionResult, ACTION_FAILED, ACTION_FORBIDDEN, ACTION_SIGNED_OUT } from "@/lib/action-result";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { PermissionError, SignedOutError } from "@/lib/session";

export async function guarded<T>(what: string, work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SignedOutError) return { ok: false, error: ACTION_SIGNED_OUT };
    if (error instanceof PermissionError) return { ok: false, error: ACTION_FORBIDDEN };
    rethrowNextControl(error);
    console.error(`${what} failed (${describeError(error)})`);
    return { ok: false, error: ACTION_FAILED };
  }
}
