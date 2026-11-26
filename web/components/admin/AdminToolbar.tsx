"use client";

// The admin lists' search and "Show" filter (design spec 5, Users and Audit log). The URL holds
// them (?q=, ?status= or ?action=), written with router.replace, so reload and Back keep them; the
// server reads them and sends the matching rows. A visually hidden live region says how many are
// shown after a change. Only writes the URL while this page is the one showing (Next keeps
// recently visited pages mounted but hidden).
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { SearchIcon } from "../icons";

export interface ToolbarState {
  q: string;
  show: string;
}

export function AdminToolbar({
  path,
  param,
  state,
  options,
  placeholder,
  announcement,
  searchRef,
  onChange,
}: {
  /** This page's route, e.g. "/admin/users". */
  path: string;
  /** The filter's query name: "status" or "action". */
  param: string;
  state: ToolbarState;
  options: readonly { value: string; label: string }[];
  /** Null for no search field (Audit log). */
  placeholder: string | null;
  /** "{n} people shown", for the live region; announced after a change only. */
  announcement: string;
  searchRef?: React.Ref<HTMLInputElement>;
  onChange(next: ToolbarState): void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchId = useId();
  const showId = useId();
  const [, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const [changed, setChanged] = useState(false);

  function write(next: ToolbarState, delay: number) {
    onChange(next);
    setChanged(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (pathname !== path) return;
      const params = new URLSearchParams();
      if (next.q.trim()) params.set("q", next.q.trim());
      if (next.show !== "all") params.set(param, next.show);
      const query = params.toString();
      startTransition(() => router.replace(query ? `${path}?${query}` : path, { scroll: false }));
    }, delay);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="flex flex-wrap gap-2">
      {placeholder !== null && (
        <div className="relative min-w-[180px] flex-[1_1_180px]">
          <label htmlFor={searchId} className="sr-only">
            Search this page
          </label>
          <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={state.q}
            onChange={(e) => write({ ...state, q: e.target.value }, 300)}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            className="type-input h-11 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-ink"
          />
        </div>
      )}
      <div className="w-auto flex-none">
        <label htmlFor={showId} className="sr-only">
          Show
        </label>
        <select
          id={showId}
          value={state.show}
          onChange={(e) => write({ ...state, show: e.target.value }, 0)}
          className="type-input h-11 rounded-md border border-line-strong bg-surface px-3 text-ink"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {changed ? announcement : ""}
      </p>
    </div>
  );
}
