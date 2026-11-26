"use client";

import { useEffect, useId, useRef, useState } from "react";
import { STATUS_OPTIONS, type TagOption, parseStatus } from "@/lib/filter";
import { SearchIcon } from "../icons";
import { useFilter } from "./FilterProvider";

const ANNOUNCE_DELAY_MS = 400;

/**
 * Search field and status filter (design spec 4, Toolbar), plus an optional third select for a
 * page's own tag filter (Courses & badges). Each select takes its natural width; when the row
 * runs out of room the tag filter wraps under the search.
 */
export function Toolbar({
  placeholder,
  tagFilter,
}: {
  placeholder: string;
  /** Visually hidden label and the choices; the first choice (value "") shows everything. */
  tagFilter?: { label: string; options: readonly TagOption[] };
}) {
  const f = useFilter();
  const statusId = useId();
  const tagId = useId();
  const shown = f.visibility.items.size;

  // "{n} items shown", 400 ms after the last change; silent on first load.
  const [message, setMessage] = useState("");
  const firstKey = useRef(f.key);
  useEffect(() => {
    if (f.key === firstKey.current) return;
    firstKey.current = "";
    const timer = window.setTimeout(() => setMessage(`${shown} ${shown === 1 ? "item" : "items"} shown`), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [f.key, shown]);

  return (
    // min-w-0: a wide tag filter shrinks to the column instead of widening the page.
    <div className="flex min-w-0 flex-wrap gap-2">
      <div className="relative min-w-[180px] flex-[1_1_180px]">
        <label htmlFor={f.searchId} className="sr-only">
          Search this page
        </label>
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          id={f.searchId}
          type="search"
          value={f.state.q}
          onChange={(e) => f.setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="type-input h-11 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-ink"
        />
      </div>
      <div className="w-auto flex-none">
        <label htmlFor={statusId} className="sr-only">
          Show
        </label>
        <select
          id={statusId}
          value={f.state.status}
          onChange={(e) => f.setStatus(parseStatus(e.target.value))}
          className="type-input h-11 rounded-md border border-line-strong bg-surface px-3 text-ink"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {tagFilter && (
        <div className="w-auto max-w-full flex-none">
          <label htmlFor={tagId} className="sr-only">
            {tagFilter.label}
          </label>
          <select
            id={tagId}
            value={f.state.tag ?? ""}
            onChange={(e) => f.setTag(e.target.value)}
            className="type-input h-11 max-w-full rounded-md border border-line-strong bg-surface px-3 text-ink"
          >
            {tagFilter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
