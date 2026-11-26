"use client";

// What every write control on the page needs to know (design spec 6):
// - signed out while using: a save was refused for sign-in reasons. One error banner with "Sign in";
//   every write control is disabled and note fields turn read-only; typed text stays in place.
//   Lasts until the page is reloaded.
// - save failed: items whose last save failed. One error banner for the page, each item has its
//   own "Try again"; the banner goes when every failed item is saved or the page is left.
// - offline: ticks are disabled while the browser reports no connection. Note and weekly-notes
//   fields stay editable; their changes wait and save by themselves when the connection returns,
//   so their failures stop counting as failed (they are "not saved yet" instead).
// - unsaved text: note, link and weekly-notes fields with changes not saved yet, so the signed-out
//   banner can say to copy them. Kept outside React state, so typing never re-renders every row.
import { usePathname } from "next/navigation";
import { createContext, use, useState } from "react";
import { type FieldMode, isTextFailureKey } from "@/lib/save-state";
import { useOnline } from "../useOnline";

/** A set of keys that components can subscribe to (useSyncExternalStore). */
export interface KeyStore {
  set(key: string, on: boolean): void;
  subscribe(listener: () => void): () => void;
  any(): boolean;
}

function createKeyStore(): KeyStore {
  const keys = new Set<string>();
  const listeners = new Set<() => void>();
  return {
    set(key, on) {
      if (keys.has(key) === on) return;
      if (on) keys.add(key);
      else keys.delete(key);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    any: () => keys.size > 0,
  };
}

interface SaveStatus {
  signedOut: boolean;
  online: boolean;
  /** Keys of items (on the current page) whose last save failed. */
  failed: ReadonlySet<string>;
  /** Text fields with unsaved changes. */
  unsaved: KeyStore;
  markSignedOut(): void;
  reportFailure(key: string): void;
  clearFailure(key: string): void;
}

const SaveStatusContext = createContext<SaveStatus | null>(null);

export function SaveStatusProvider({ children }: { children: React.ReactNode }) {
  const online = useOnline();
  const pathname = usePathname();
  const [signedOut, setSignedOut] = useState(false);
  const [unsaved] = useState(createKeyStore);
  const [failed, setFailed] = useState<{ path: string; keys: ReadonlySet<string> }>({ path: pathname, keys: new Set() });
  // Going offline: failed note changes now wait for the connection and save by themselves when it
  // returns, so only failed ticks still count (they keep their Try again).
  const [wasOnline, setWasOnline] = useState(online);
  if (online !== wasOnline) {
    setWasOnline(online);
    if (!online && [...failed.keys].some(isTextFailureKey)) {
      setFailed({ path: failed.path, keys: new Set([...failed.keys].filter((k) => !isTextFailureKey(k))) });
    }
  }
  // Leaving the page ends its save-failed banner (the items keep their own Try again).
  const keys = failed.path === pathname ? failed.keys : EMPTY;

  const value: SaveStatus = {
    signedOut,
    online,
    failed: keys,
    unsaved,
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
  unsaved: createKeyStore(),
  markSignedOut: () => {},
  reportFailure: () => {},
  clearFailure: () => {},
};

export function useSaveStatus(): SaveStatus {
  return use(SaveStatusContext) ?? OUTSIDE;
}

/** Whether ticks may be used: signed in as the owner, not signed out since, and online. */
export function useCanWrite(readOnly: boolean): boolean {
  const s = useSaveStatus();
  return !readOnly && !s.signedOut && s.online;
}

/**
 * What note, link and weekly-notes fields may do. Offline they stay editable (changes wait for
 * the connection); signed out, or without the owner's sign-in, they are read-only.
 */
export function useFieldMode(readOnly: boolean): FieldMode {
  const s = useSaveStatus();
  if (readOnly || s.signedOut) return "read-only";
  return s.online ? "write" : "offline";
}
