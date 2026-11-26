"use client";

// One autosaving text field (a note, a link, the weekly notes). Design spec 4, NoteEditor:
// saves 800 ms after typing stops and at once on blur; "Saving…", then "Saved" (clears after
// 2.5 s) or "Not saved" with Try again. The typed text is never thrown away: a failed save keeps
// it, and a newer value from the server is only taken while there are no unsaved edits.
import { useEffect, useRef, useState } from "react";
import { AUTOSAVE_DELAY_MS, SAVED_VISIBLE_MS, type SaveStatus } from "@/lib/save-state";
import type { SaveResult } from "@/lib/save-result";
import { safeCall } from "./safeCall";
import { useSaveStatus } from "./SaveStatusProvider";

export interface FieldSaver {
  value: string;
  /** The last value the server confirmed. */
  saved: string;
  status: SaveStatus;
  /** A message to show next to the field (a rule it breaks), or null. */
  error: string | null;
  onChange(value: string): void;
  /** Save now if there are changes (blur, closing the editor). */
  flush(): void;
  retry(): void;
}

export function useFieldSaver({
  serverValue,
  save,
  check,
  failureKey,
  canWrite,
}: {
  /** The value from the server render. */
  serverValue: string;
  save: (value: string) => Promise<SaveResult>;
  /** Client-side rule, the same one the server applies (for links: `linkProblem`). */
  check?: (value: string) => string | null;
  /** Identifies this field in the page's save-failed banner. */
  failureKey: string;
  canWrite: boolean;
}): FieldSaver {
  const page = useSaveStatus();
  const [value, setValue] = useState(serverValue);
  const [saved, setSaved] = useState(serverValue);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // A newer server value (saved elsewhere, or by the page refresh after a save) replaces the field
  // only while it has no unsaved edits.
  const [lastServerValue, setLastServerValue] = useState(serverValue);
  if (serverValue !== lastServerValue) {
    setLastServerValue(serverValue);
    if (value === saved) {
      setValue(serverValue);
      setSaved(serverValue);
    }
  }

  // Async code reads the latest values through refs; they are kept in step after each render.
  const latest = useRef({ value, saved, canWrite });
  useEffect(() => {
    latest.current = { value, saved, canWrite };
  });
  const typingTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const again = useRef(false);
  useEffect(
    () => () => {
      window.clearTimeout(typingTimer.current);
      window.clearTimeout(savedTimer.current);
    },
    [],
  );

  async function persist(showProblem: boolean): Promise<void> {
    window.clearTimeout(typingTimer.current);
    const { value: current, saved: confirmed, canWrite: writable } = latest.current;
    if (!writable) return;
    const problem = check?.(current) ?? null;
    if (problem) {
      if (showProblem) setError(problem);
      return;
    }
    if (current === confirmed) {
      // Back to the saved text after a failure: nothing left to save.
      setStatus((s) => (s === "error" ? "idle" : s));
      page.clearFailure(failureKey);
      return;
    }
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    window.clearTimeout(savedTimer.current);
    setStatus("saving");
    const result = await safeCall(() => save(current));
    busy.current = false;

    if (result.ok) {
      latest.current = { ...latest.current, saved: current };
      setSaved(current);
      setError(null);
      page.clearFailure(failureKey);
      if (again.current || latest.current.value !== current) {
        again.current = false;
        return persist(false);
      }
      setStatus("saved");
      savedTimer.current = window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), SAVED_VISIBLE_MS);
      return;
    }
    again.current = false;
    if (result.error.code === "invalid") {
      setError(result.error.message);
      setStatus("idle");
    } else if (result.error.code === "signed-out") {
      page.markSignedOut();
      setStatus("error");
    } else {
      setStatus("error");
      page.reportFailure(failureKey);
    }
  }

  return {
    value,
    saved,
    status,
    error,
    onChange(next) {
      setValue(next);
      latest.current = { ...latest.current, value: next };
      // A shown problem goes away as soon as the field is fixed.
      if (error && !(check?.(next) ?? null)) setError(null);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => void persist(false), AUTOSAVE_DELAY_MS);
    },
    flush: () => void persist(true),
    retry: () => void persist(true),
  };
}
