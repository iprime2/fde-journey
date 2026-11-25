"use client";

// Open state for a remembered <details> (Scaler modules, resource lists): the stored choice when
// no filter is active; forced open while a search or filter matches inside, until the owner
// closes it again.
import { useState } from "react";
import { isStoredOpen, withMember } from "@/lib/open-state";
import { useFilter } from "./filter/FilterProvider";
import { useStoredList, writeStoredList } from "./useStoredList";

export function useRememberedDetails({
  storageKey,
  member,
  defaults,
  matchInside,
  asNumbers = false,
}: {
  storageKey: string;
  member: string;
  /** Members open before anything is stored (the current module; no resource lists). */
  defaults: readonly string[];
  /** A search or filter is active and something inside matches. */
  matchInside: boolean;
  /** Store members as numbers (module numbers, as the tracker did). */
  asNumbers?: boolean;
}) {
  const f = useFilter();
  const stored = useStoredList(storageKey);
  const [choice, setChoice] = useState<{ key: string; open: boolean } | null>(null);

  const storedOpen = isStoredOpen(stored, member, defaults.includes(member));
  const open = f.active ? (choice?.key === f.key ? choice.open : matchInside || storedOpen) : storedOpen;

  function onToggle(e: React.ToggleEvent<HTMLDetailsElement>) {
    const nowOpen = e.currentTarget.open;
    if (nowOpen === open) return; // our own render changed it
    setChoice({ key: f.key, open: nowOpen });
    const next = withMember(stored ?? defaults, member, nowOpen);
    writeStoredList(storageKey, asNumbers ? next.map(Number) : next);
  }

  return { open, onToggle };
}
