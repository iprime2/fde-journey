// Which Scaler modules and resource lists are open, remembered on the device in localStorage
// under the tracker's keys. Pure helpers; the browser side is components/useStoredList.ts.

/** JSON array of module numbers, e.g. [1, 3]. */
export const OPEN_MODULES_KEY = "fde-open-modules";
/** JSON array of roadmap task ids whose resource list is open, e.g. ["l1-1"]. */
export const OPEN_RESOURCES_KEY = "fde-open-res";

/** The stored list as strings, or null when nothing (or nothing valid) is stored. */
export function parseStoredList(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    return value.filter((v) => typeof v === "string" || typeof v === "number").map(String);
  } catch {
    return null;
  }
}

/** The list with `member` added or removed, without duplicates. */
export function withMember(list: readonly string[], member: string, present: boolean): string[] {
  const rest = list.filter((m) => m !== member);
  return present ? [...rest, member] : rest;
}

/**
 * Open or closed when no search or filter is active. With nothing stored yet, the default
 * applies (the current module open, everything else closed); after that the stored choice wins.
 */
export const isStoredOpen = (stored: readonly string[] | null, member: string, defaultOpen: boolean) =>
  stored === null ? defaultOpen : stored.includes(member);
