"use client";

// Search and status filter for a section page. The URL is the source of truth (?q= and
// ?status=, written with history.replaceState so reload and Back keep them); the input keeps its
// own copy so typing never waits for the router. Rows, cards and labels read visibility from
// this context and hide themselves.
//
// With Cache Components, Next.js keeps recently visited pages mounted but hidden (React
// Activity), and their useSearchParams() follows whatever page is showing. So a page only follows
// URL changes while it is the current page; hidden, it keeps its filter for when Back returns.
import { usePathname, useSearchParams } from "next/navigation";
import {
  type RefObject,
  createContext,
  use,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EMPTY_FILTER,
  type FilterEntry,
  type FilterState,
  type StatusFilter,
  type UrlSync,
  type Visibility,
  computeVisibility,
  filterFromParams,
  filterKey,
  filterSearch,
  isFilterActive,
  syncFromUrl,
} from "@/lib/filter";

interface FilterContextValue {
  /** What the controls show. */
  state: FilterState;
  /** Key of the filter the rows currently reflect; changes when a new search starts. */
  key: string;
  active: boolean;
  visibility: Visibility;
  anyNotes: boolean;
  anyDone: boolean;
  /** The search field, so focus can return to it (after "Clear search and filter"). */
  searchRef: RefObject<HTMLInputElement | null>;
  setQuery(q: string): void;
  setStatus(status: StatusFilter): void;
  clear(): void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

const URL_WRITE_DELAY_MS = 300;

export function FilterProvider({
  path,
  entries,
  initial,
  children,
}: {
  /** This page's route, e.g. "/roadmap". */
  path: string;
  entries: FilterEntry[];
  /** The filter from this page's own searchParams (server render). */
  initial: FilterState;
  children: React.ReactNode;
}) {
  // The URL only describes this page while it is the page showing. Next.js can also render a
  // page in the background before navigating to it, while the URL still belongs to another page.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromUrl = pathname === path ? filterFromParams(searchParams) : null;

  const [state, setState] = useState(fromUrl ?? initial);
  const [sync, setSync] = useState<UrlSync>({ seen: filterKey(fromUrl ?? initial), pending: [] });
  // The URL changed without us (Back, Forward, a link to the plain page): follow it.
  if (fromUrl) {
    const next = syncFromUrl(sync, filterKey(fromUrl));
    if (next) {
      setSync(next.sync);
      if (next.follow) setState(fromUrl);
    }
  }

  const timer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  function writeUrl(next: FilterState) {
    window.clearTimeout(timer.current);
    if (window.location.pathname !== path) return;
    const search = filterSearch(next, window.location.search);
    if (search === window.location.search) return;
    setSync((s) => ({ ...s, pending: [...s.pending, filterKey(next)] }));
    window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
  }

  // Runs on the first render and every time the page is shown again. Hiding the page cancels a
  // pending URL write (so it can't land on another page); if a search was typed just before
  // leaving, it never reached the URL, so put it there now that the page is back.
  const restoreUrl = useEffectEvent(() => writeUrl(state));
  useEffect(() => {
    restoreUrl();
    return () => window.clearTimeout(timer.current);
  }, []);

  // Rows follow the controls a moment later, so typing stays smooth on long pages.
  const applied = useDeferredValue(state);
  const visibility = useMemo(() => computeVisibility(entries, applied), [entries, applied]);
  const anyNotes = useMemo(() => entries.some((e) => e.noted), [entries]);
  const anyDone = useMemo(() => entries.some((e) => e.done && !e.journal), [entries]);

  const value: FilterContextValue = {
    state,
    key: filterKey(applied),
    active: isFilterActive(applied),
    visibility,
    anyNotes,
    anyDone,
    searchRef,
    setQuery(q) {
      const next = { ...state, q };
      setState(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => writeUrl(next), URL_WRITE_DELAY_MS);
    },
    setStatus(status) {
      const next = { ...state, status };
      setState(next);
      writeUrl(next);
    },
    clear() {
      setState(EMPTY_FILTER);
      writeUrl(EMPTY_FILTER);
      // The button that called this disappears; keep keyboard focus on the page.
      searchRef.current?.focus();
    },
  };

  return <FilterContext value={value}>{children}</FilterContext>;
}

const NO_FILTER: FilterContextValue = {
  state: EMPTY_FILTER,
  key: filterKey(EMPTY_FILTER),
  active: false,
  visibility: { items: new Set(), sections: new Set(), groups: new Set(), openParents: new Set() },
  anyNotes: false,
  anyDone: false,
  searchRef: { current: null },
  setQuery: () => {},
  setStatus: () => {},
  clear: () => {},
};

/** The page's filter. Outside a FilterProvider everything counts as shown. */
export function useFilter(): FilterContextValue & { provided: boolean } {
  const ctx = use(FilterContext);
  return ctx ? { ...ctx, provided: true } : { ...NO_FILTER, provided: false };
}
