// Pure rules for saving from the browser: when a text field saves, what its status line and the
// collapsed note row say, note button labels and the daily session renewal. The components that
// use them are in components/save/ and components/notes/. Design spec 4 (NoteEditor) and 8.
import type { SaveError } from "./save-result";

/**
 * One field's save state.
 * - "error": the last save failed; it can be retried.
 * - "waiting": not saved yet because the browser is offline; it saves when the connection returns.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error" | "waiting";

/**
 * What a text field may do:
 * - "write": edit and save;
 * - "offline": edit, but saving waits for the connection;
 * - "read-only": signed out (or never signed in): the text stays readable but can't change.
 */
export type FieldMode = "write" | "offline" | "read-only";

/** Saves start 800 ms after typing stops (and at once on blur). */
export const AUTOSAVE_DELAY_MS = 800;
/** "Saved" clears itself after 2.5 s. */
export const SAVED_VISIBLE_MS = 2_500;
/** A closed note row only says "Saving…" once a save has been running this long (no flicker). */
export const CLOSED_SAVING_DELAY_MS = 1_000;

/** Status line copy (design spec 8). */
export const SAVE_TEXT = {
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved.",
  waiting: "Not saved yet. Saves when you're back online.",
} as const;

/**
 * What a save attempt should do now:
 * - "blocked": read-only; nothing can be saved;
 * - "queue": a save of this field is running; decide again when it ends;
 * - "problem": the text breaks the field's rule (a link that isn't https://); don't send it;
 * - "unchanged": the text is what was last saved; nothing to send;
 * - "wait": offline; save when the connection returns;
 * - "save": send it.
 */
export type SaveStep = "blocked" | "queue" | "problem" | "unchanged" | "wait" | "save";

export function nextSaveStep(s: {
  mode: FieldMode;
  /** A save of this field is running. */
  busy: boolean;
  /** The field's rule broken by `value`, or null. */
  problem: string | null;
  value: string;
  saved: string;
}): SaveStep {
  if (s.mode === "read-only") return "blocked";
  if (s.busy) return "queue";
  if (s.problem !== null) return "problem";
  if (s.value === s.saved) return "unchanged";
  if (s.mode === "offline") return "wait";
  return "save";
}

/**
 * The status a field keeps after a step that sends nothing. It never stays "saving" (only a
 * finished save may end that), and a "Saved" that is still showing stays.
 */
export function statusAfterStep(step: Exclude<SaveStep, "save" | "queue" | "blocked">, current: SaveStatus): SaveStatus {
  switch (step) {
    case "wait":
      return "waiting";
    case "unchanged":
      return current === "saved" ? "saved" : "idle";
    default:
      return "idle";
  }
}

/** After a save succeeded: save again if the text changed while it ran, else show "Saved". */
export function afterSaveSucceeded(sent: string, latest: string): "again" | "saved" {
  return latest === sent ? "saved" : "again";
}

/**
 * After a save failed:
 * - "invalid": show the rule under the field (or "again" if the text changed while the save ran,
 *   so the newer text gets its own answer);
 * - "signed-out": the page shows the signed-out banner;
 * - "waiting": the connection dropped; it counts as not saved yet and saves when back online;
 * - "error": "Not saved." with Try again.
 */
export function afterSaveFailed(code: SaveError["code"], s: { online: boolean; changed: boolean }): "invalid" | "again" | "signed-out" | "waiting" | "error" {
  if (code === "invalid") return s.changed ? "again" : "invalid";
  if (code === "signed-out") return "signed-out";
  return s.online ? "error" : "waiting";
}

/**
 * The status a field shows. Offline, any unsaved text waits for the connection (a save still on
 * its way counts as not saved yet), unless it breaks the field's rule and couldn't save anyway.
 * Signed out, unsaved text is "Not saved." for good.
 */
export function shownStatus(stored: SaveStatus, s: { mode: FieldMode; dirty: boolean; problem: boolean }): SaveStatus {
  if (s.mode === "offline" && s.dirty && !s.problem) return "waiting";
  if (s.mode === "read-only" && s.dirty) return "error";
  return stored;
}

const PRIORITY: Record<SaveStatus, number> = { error: 4, waiting: 3, saving: 2, saved: 1, idle: 0 };

/** The note editor's single status line for its two fields: a failure wins, then waiting, saving, saved. */
export function combineStatus(statuses: readonly SaveStatus[]): SaveStatus {
  return statuses.reduce<SaveStatus>((a, b) => (PRIORITY[b] > PRIORITY[a] ? b : a), "idle");
}

/** Status line copy for a status (design spec 8). */
export function statusText(status: SaveStatus): string {
  return status === "idle" ? "" : SAVE_TEXT[status];
}

/** "Hide note" while the editor is open, "Edit note" when the note or link holds any text (saved or not), else "Add note". */
export function noteButtonLabel(open: boolean, hasText: boolean): "Hide note" | "Edit note" | "Add note" {
  if (open) return "Hide note";
  return hasText ? "Edit note" : "Add note";
}

export type LineTone = "muted" | "danger" | "warn";
export type LineAction = "retry" | "fix-note" | "fix-link";

/** One message line with its optional inline action ("Try again", "Fix link", "Fix note"). */
export interface SaveLine {
  text: string;
  tone: LineTone;
  action: LineAction | null;
}

export interface FieldView {
  /** "note" and "link" are the two fields of a note; "journal" is the weekly notes. */
  kind: "note" | "link" | "journal";
  /** The status the field shows (shownStatus). */
  status: SaveStatus;
  /** A rule the field breaks, shown under it, or null. */
  error: string | null;
}

export interface SaveLines {
  /** Show "Saving…" (never announced). */
  saving: boolean;
  /** Show "Saved" (announced; visible only while the editor is open). */
  saved: boolean;
  /** "Not saved." (with Try again unless signed out) or "Not saved yet…". Announced. */
  save: SaveLine | null;
  /** The rule a field breaks, e.g. "Link not saved. Links must start with https://". Announced. */
  field: SaveLine | null;
}

const FIELD_PREFIX: Record<FieldView["kind"], string> = {
  note: "Note not saved.",
  link: "Link not saved.",
  journal: "Not saved.",
};

/**
 * The lines under a note (or the weekly notes), from its fields' states. The collapsed note row
 * shows them as in the table in design spec 4 ("Closing with unsaved changes"); the open editor
 * shows the save line in its status line and each field's rule under that field.
 *
 * `savingShown`: whether "Saving…" may show yet. The open editor always shows it; the collapsed
 * row only once the save has run for 1 s, or at once after Try again.
 */
export function saveLines({
  fields,
  signedOut,
  savingShown,
}: {
  fields: readonly FieldView[];
  signedOut: boolean;
  savingShown: boolean;
}): SaveLines {
  const status = combineStatus(fields.map((f) => f.status));
  let save: SaveLine | null = null;
  if (status === "error") save = { text: SAVE_TEXT.error, tone: "danger", action: signedOut ? null : "retry" };
  else if (status === "waiting") save = { text: SAVE_TEXT.waiting, tone: "warn", action: null };

  const broken = fields.find((f) => f.error !== null);
  const field: SaveLine | null = broken
    ? {
        text: `${FIELD_PREFIX[broken.kind]} ${broken.error}`,
        tone: "danger",
        // Signed out, the fields are read-only, so there is nothing to fix.
        action: signedOut || broken.kind === "journal" ? null : broken.kind === "link" ? "fix-link" : "fix-note",
      }
    : null;

  return { saving: status === "saving" && savingShown, saved: status === "saved", save, field };
}

/** Failure keys of text fields (notes, links, weekly notes) as opposed to ticks ("tick:…"). */
export const isTextFailureKey = (key: string) => key.startsWith("note:") || key.startsWith("link:");

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
