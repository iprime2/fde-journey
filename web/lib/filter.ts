// Search and status filter for the section pages. Pure functions; the page state lives in the
// URL as ?q= and ?status= (see components/filter/FilterProvider.tsx).

export type StatusFilter = "all" | "open" | "done" | "noted";

export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All items" },
  { value: "open", label: "Not done" },
  { value: "done", label: "Done" },
  { value: "noted", label: "With notes" },
];

export interface FilterState {
  q: string;
  status: StatusFilter;
}

export const EMPTY_FILTER: FilterState = { q: "", status: "all" };

/** One searchable row on a page. */
export interface FilterEntry {
  id: string;
  /** Lower-case text that search matches: title, index, meta, why line, note and link. */
  text: string;
  done: boolean;
  /** Has a note or a link. */
  noted: boolean;
  /** The card the row sits in. */
  section: string;
  /** Group of cards, for group labels ("core", "elective"). */
  group?: string;
  /** For a learning resource: the roadmap task it belongs to. */
  parent?: string;
  /** Weekly notes: shown only under "All items" and "With notes". */
  journal?: boolean;
}

export function parseStatus(raw: string | null | undefined): StatusFilter {
  return STATUS_OPTIONS.some((o) => o.value === raw) ? (raw as StatusFilter) : "all";
}

const first = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v);

/** From a page's `searchParams` object. */
export function filterFromRecord(sp: Record<string, string | string[] | undefined>): FilterState {
  return { q: first(sp.q) ?? "", status: parseStatus(first(sp.status)) };
}

/** From `URLSearchParams` (or Next.js's read-only version). */
export function filterFromParams(params: { get(name: string): string | null }): FilterState {
  return { q: params.get("q") ?? "", status: parseStatus(params.get("status")) };
}

export const filterKey = (s: FilterState) => JSON.stringify([s.q, s.status]);

export const isFilterActive = (s: FilterState) => s.q.trim() !== "" || s.status !== "all";

/** The query string for `s`, keeping any other parameters in `currentSearch`. "" when empty. */
export function filterSearch(s: FilterState, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  if (s.q) params.set("q", s.q);
  else params.delete("q");
  if (s.status !== "all") params.set("status", s.status);
  else params.delete("status");
  const out = params.toString();
  return out ? `?${out}` : "";
}

export function matchesEntry(e: FilterEntry, s: FilterState): boolean {
  const q = s.q.trim().toLowerCase();
  if (q && !e.text.includes(q)) return false;
  if (e.journal) return s.status === "all" || s.status === "noted";
  switch (s.status) {
    case "open":
      return !e.done;
    case "done":
      return e.done;
    case "noted":
      return e.noted;
    default:
      return true;
  }
}

export interface Visibility {
  items: ReadonlySet<string>;
  sections: ReadonlySet<string>;
  groups: ReadonlySet<string>;
  /** Tasks with at least one matching learning resource. */
  openParents: ReadonlySet<string>;
}

/**
 * Which rows, cards and group labels to show. A task stays visible when one of its learning
 * resources matches, so the match can be seen in context (the tracker's rule).
 */
export function computeVisibility(entries: readonly FilterEntry[], s: FilterState): Visibility {
  const direct = new Set(entries.filter((e) => matchesEntry(e, s)).map((e) => e.id));
  const openParents = new Set<string>();
  for (const e of entries) if (e.parent && direct.has(e.id)) openParents.add(e.parent);
  const items = new Set<string>();
  const sections = new Set<string>();
  const groups = new Set<string>();
  for (const e of entries) {
    const shown = direct.has(e.id) || (!e.parent && openParents.has(e.id));
    if (!shown) continue;
    items.add(e.id);
    sections.add(e.section);
    if (e.group) groups.add(e.group);
  }
  return { items, sections, groups, openParents };
}

/** What a page knows about the URL: the filter key it last saw, and its own writes still in flight. */
export interface UrlSync {
  seen: string;
  /** Keys this page wrote to the URL that the router has not shown yet, oldest first. */
  pending: readonly string[];
}

/**
 * When the URL's filter key changes: null if nothing changed; otherwise the new sync state and
 * whether to follow the URL. A change that matches one of the page's own writes is not followed
 * (the input already shows it, and may have moved on); that write and any older ones are done.
 */
export function syncFromUrl(sync: UrlSync, urlKey: string): { sync: UrlSync; follow: boolean } | null {
  if (urlKey === sync.seen) return null;
  const own = sync.pending.indexOf(urlKey);
  if (own >= 0) return { sync: { seen: urlKey, pending: sync.pending.slice(own + 1) }, follow: false };
  return { sync: { seen: urlKey, pending: sync.pending }, follow: true };
}

export type EmptyKind = "no-notes" | "no-done" | "no-match";

/**
 * Why nothing is shown: no notes at all under "With notes", nothing ticked at all under "Done"
 * (with no search), or simply no match.
 */
export function emptyKind(s: FilterState, counts: { anyNotes: boolean; anyDone: boolean }): EmptyKind {
  if (s.status === "noted" && !counts.anyNotes) return "no-notes";
  if (s.status === "done" && s.q.trim() === "" && !counts.anyDone) return "no-done";
  return "no-match";
}
