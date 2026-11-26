// Saved progress, keyed by item id (lib/ids.ts). Same fields as the tracker's records.
// Safe to import from client components: no database code here. The database read is
// `getProgress()` in lib/data.ts; saving goes through the Server Actions in app/actions/progress.ts.

export interface ProgressRecord {
  done: boolean;
  note: string;
  link: string;
  /** ISO timestamp, or null when not done. */
  doneAt: string | null;
  updatedAt: string | null;
}

/** One saved record with its item id, as returned by the save actions. */
export interface ProgressEntry extends ProgressRecord {
  itemId: string;
}

export type ProgressMap = ReadonlyMap<string, ProgressRecord>;

export const EMPTY_RECORD: ProgressRecord = { done: false, note: "", link: "", doneAt: null, updatedAt: null };

export const isDone = (progress: ProgressMap, id: string) => progress.get(id)?.done === true;

export const countDone = (progress: ProgressMap, ids: readonly string[]) => ids.filter((id) => isDone(progress, id)).length;
