"use client";

// A list kept in localStorage (open modules, open resource lists). The server render and the
// first browser render see "nothing stored" (null), so hydration always matches; the stored value
// applies right after.
import { useMemo, useSyncExternalStore } from "react";
import { parseStoredList } from "@/lib/open-state";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage blocked: fall back to the defaults
  }
}

export function useStoredList(key: string): string[] | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  return useMemo(() => parseStoredList(raw), [raw]);
}

export function writeStoredList(key: string, values: ReadonlyArray<string | number>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage full or blocked: the choice just isn't remembered.
  }
  listeners.forEach((l) => l());
}
