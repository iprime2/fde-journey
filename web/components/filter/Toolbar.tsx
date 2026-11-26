"use client";

import { useEffect, useId, useRef, useState } from "react";
import { STATUS_OPTIONS, parseStatus } from "@/lib/filter";
import { SearchIcon } from "../icons";
import { useFilter } from "./FilterProvider";

const ANNOUNCE_DELAY_MS = 400;

/** Search field and status filter (design spec 4, Toolbar). */
export function Toolbar({ placeholder }: { placeholder: string }) {
  const f = useFilter();
  const statusId = useId();
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
    <div className="flex flex-wrap gap-2">
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
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
