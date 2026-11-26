// What every save action returns. Safe to import from client components.
import type { ProgressEntry } from "./progress";

export type SaveField = "itemId" | "done" | "note" | "link";

export type SaveError =
  /** No valid sign-in for the owner (signed out, session expired, or another account). */
  | { code: "signed-out"; message: string }
  /** The input broke a rule. `message` is written for the owner and can be shown as is. */
  | { code: "invalid"; field: SaveField; message: string }
  /** Anything else (database unreachable and so on). Safe to retry. */
  | { code: "failed"; message: string };

export type SaveResult = { ok: true; record: ProgressEntry } | { ok: false; error: SaveError };

export const SIGNED_OUT_ERROR: SaveError = { code: "signed-out", message: "You were signed out, so that change wasn't saved." };
export const FAILED_ERROR: SaveError = { code: "failed", message: "That change wasn't saved. Check your connection, then try again." };
