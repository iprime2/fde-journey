// Pure rules for saving from the browser: status lines, note button labels and the daily session
// renewal. The components that use them are in components/save/ and components/notes/.

/** One field's save state. "error" means the last save failed and can be retried. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Saves start 800 ms after typing stops (and at once on blur). */
export const AUTOSAVE_DELAY_MS = 800;
/** "Saved" clears itself after 2.5 s. */
export const SAVED_VISIBLE_MS = 2_500;

const PRIORITY: Record<SaveStatus, number> = { error: 3, saving: 2, saved: 1, idle: 0 };

/** The note editor's single status line for its two fields: a failure wins, then saving, then saved. */
export function combineStatus(statuses: readonly SaveStatus[]): SaveStatus {
  return statuses.reduce<SaveStatus>((a, b) => (PRIORITY[b] > PRIORITY[a] ? b : a), "idle");
}

/** Status line copy (design spec 8). */
export function statusText(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Not saved";
    default:
      return "";
  }
}

/** "Hide note" while the editor is open, "Edit note" once a note or link is saved, else "Add note". */
export function noteButtonLabel(open: boolean, hasSavedNote: boolean): "Hide note" | "Edit note" | "Add note" {
  if (open) return "Hide note";
  return hasSavedNote ? "Edit note" : "Add note";
}

/** localStorage key holding when the browser last renewed the sign-in (epoch ms). */
export const SESSION_REFRESHED_KEY = "fde-session-refreshed-at";
export const SESSION_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** A stored timestamp, or null when missing or not a sensible number. */
export function parseTimestamp(raw: string | null): number | null {
  if (raw === null || !/^\d{1,16}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Whether to ask the server to renew the sign-in: never done, a day or more ago, or a stored time
 * in the future (a changed clock), so a bad value can't block renewal.
 */
export function isRefreshDue(lastMs: number | null, nowMs: number, intervalMs = SESSION_REFRESH_INTERVAL_MS): boolean {
  if (lastMs === null) return true;
  if (lastMs > nowMs) return true;
  return nowMs - lastMs >= intervalMs;
}
