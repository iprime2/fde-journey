// What the M4b Server Actions (settings, account, admin) return. Safe to import from client
// components. Messages are written for people and can be shown as they are (design spec 8); they
// never quote a database error.

export type ActionError =
  /** No usable sign-in (signed out, suspended, or waitlisted where a place is needed). */
  | { code: "signed-out"; message: string }
  /** The user lacks the admin permission, or the target can't be changed by them (the owner, an admin, themselves). */
  | { code: "forbidden"; message: string }
  /** The input broke a rule. `field` names the input when there is one. */
  | { code: "invalid"; field?: string; message: string }
  /** The person or key isn't there (any more), or isn't in the state the action needs. */
  | { code: "not-found"; message: string }
  /** All places are taken. */
  | { code: "no-place"; message: string }
  /** Too many tries; try again later. */
  | { code: "rate-limited"; message: string }
  /** Anything else (database unreachable and so on). Nothing was changed; safe to retry. */
  | { code: "failed"; message: string };

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: ActionError };

export const ACTION_SIGNED_OUT: ActionError = { code: "signed-out", message: "You were signed out, so that wasn't saved." };
export const ACTION_FORBIDDEN: ActionError = { code: "forbidden", message: "You no longer have permission to do this." };
export const ACTION_FAILED: ActionError = { code: "failed", message: "That didn't work, and nothing was changed. Try again." };

export const ok = <T,>(value: T): ActionResult<T> => ({ ok: true, value });
export const fail = (error: ActionError): ActionResult<never> => ({ ok: false, error });
export const invalid = (message: string, field?: string): ActionResult<never> => fail({ code: "invalid", message, ...(field ? { field } : {}) });
