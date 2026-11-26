// Saved progress, keyed by item id (lib/ids.ts). Same fields as the tracker's records.

export interface ProgressRecord {
  done: boolean;
  note: string;
  link: string;
  /** ISO timestamp, or null when not done. */
  doneAt: string | null;
  updatedAt: string | null;
}

export type ProgressMap = ReadonlyMap<string, ProgressRecord>;

/**
 * M1: there is no database yet, so nothing is saved and every item shows as not done.
 * M2 replaces this with a database read for the signed-in owner; callers stay the same.
 */
export async function getProgress(): Promise<ProgressMap> {
  return new Map();
}

export const isDone = (progress: ProgressMap, id: string) => progress.get(id)?.done === true;

export const countDone = (progress: ProgressMap, ids: readonly string[]) => ids.filter((id) => isDone(progress, id)).length;
