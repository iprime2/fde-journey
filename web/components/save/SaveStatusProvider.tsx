"use client";

// What every write control on the page needs to know (design spec 6):
// - signed out while using: a save was refused for sign-in reasons. One error banner with "Sign in";
//   every write control is disabled; typed text stays in place. Lasts until the page is reloaded.
// - save failed: items whose last save failed. One error banner for the page, each item has its
//   own "Try again"; the banner goes when every failed item is saved or the page is left.
// - offline: write controls are disabled while the browser reports no connection.
import { usePathname } from "next/navigation";
import { createContext, use, useState } from "react";
import { useOnline } from "../useOnline";

interface SaveStatus {
  signedOut: boolean;
  online: boolean;
  /** Keys of items (on the current page) whose last save failed. */
  failed: ReadonlySet<string>;
  markSignedOut(): void;
  reportFailure(key: string): void;
  clearFailure(key: string): void;
}

const SaveStatusContext = createContext<SaveStatus | null>(null);

export function SaveStatusProvider({ children }: { children: React.ReactNode }) {
  const online = useOnline();
  const pathname = usePathname();
  const [signedOut, setSignedOut] = useState(false);
  const [failed, setFailed] = useState<{ path: string; keys: ReadonlySet<string> }>({ path: pathname, keys: new Set() });
  // Leaving the page ends its save-failed banner (the items keep their own Try again).
  const keys = failed.path === pathname ? failed.keys : EMPTY;

  const value: SaveStatus = {
    signedOut,
    online,
    failed: keys,
    markSignedOut: () => setSignedOut(true),
    reportFailure: (key) =>
      setFailed((f) => {
        const next = new Set(f.path === pathname ? f.keys : EMPTY);
        next.add(key);
        return { path: pathname, keys: next };
      }),
    clearFailure: (key) =>
      setFailed((f) => {
        if (!f.keys.has(key)) return f;
        const next = new Set(f.keys);
        next.delete(key);
        return { path: f.path, keys: next };
      }),
  };
  return <SaveStatusContext value={value}>{children}</SaveStatusContext>;
}

const EMPTY: ReadonlySet<string> = new Set();

const OUTSIDE: SaveStatus = {
  signedOut: false,
  online: true,
  failed: EMPTY,
  markSignedOut: () => {},
  reportFailure: () => {},
  clearFailure: () => {},
};

export function useSaveStatus(): SaveStatus {
  return use(SaveStatusContext) ?? OUTSIDE;
}

/** Whether write controls may be used: signed in as the owner, not signed out since, and online. */
export function useCanWrite(readOnly: boolean): boolean {
  const s = useSaveStatus();
  return !readOnly && !s.signedOut && s.online;
}
