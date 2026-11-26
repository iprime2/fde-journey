"use client";

// One autosaving text field (a note, a link, the weekly notes). Design spec 4, NoteEditor:
// saves 800 ms after typing stops and at once on blur; "Saving…", then "Saved" (clears after
// 2.5 s) or "Not saved." with Try again. Offline the field stays editable and its changes wait
// ("Not saved yet…"); when the connection returns, unsaved or failed changes save by themselves,
// once. The typed text is never thrown away: a failed save keeps it, and a newer value from the
// server is only taken while there are no unsaved edits. The decisions are pure functions in
// lib/save-state.ts.
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  AUTOSAVE_DELAY_MS,
  type FieldMode,
  SAVED_VISIBLE_MS,
  type SaveStatus,
  afterSaveFailed,
  afterSaveSucceeded,
  nextSaveStep,
  shownStatus,
  statusAfterStep,
} from "@/lib/save-state";
import type { SaveResult } from "@/lib/save-result";
import { safeCall } from "./safeCall";
import { useSaveStatus } from "./SaveStatusProvider";

export interface FieldSaver {
  value: string;
  /** The last value the server confirmed. */
  saved: string;
  /** What the field's status line should say (offline and signed out included). */
  status: SaveStatus;
  /** A rule the field breaks (shown next to it), or null. */
  error: string | null;
  onChange(value: string): void;
  /** Save now if there are changes (blur, closing the editor). */
  flush(): void;
  /**
   * Don't save after the typing pause: focus moved to this field's Try again, which saves when
   * pressed. A save started now would remove Try again just as focus arrives on it.
   */
  hold(): void;
  retry(): void;
}

/** The mode, corrected by the browser's own flag in case React hasn't caught up with it yet. */
function effectiveMode(mode: FieldMode): FieldMode {
  return mode === "write" && typeof navigator !== "undefined" && !navigator.onLine ? "offline" : mode;
}

export function useFieldSaver({
  serverValue,
  save,
  check,
  failureKey,
  mode,
}: {
  /** The value from the server render. */
  serverValue: string;
  save: (value: string) => Promise<SaveResult>;
  /** Client-side rule, the same one the server applies (for links: `linkProblem`). */
  check?: (value: string) => string | null;
  /** Identifies this field in the page's save-failed banner. */
  failureKey: string;
  mode: FieldMode;
}): FieldSaver {
  const page = useSaveStatus();
  const [value, setValue] = useState(serverValue);
  const [saved, setSaved] = useState(serverValue);
  const [stored, setStored] = useState<SaveStatus>("idle");
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

  const problem = check?.(value) ?? null;
  const dirty = value !== saved;

  // Going offline: anything not saved yet, including a save still on its way, now waits for the
  // connection. Stored (not only shown), so nothing flashes "Not saved." when it comes back.
  const [lastMode, setLastMode] = useState(mode);
  if (mode !== lastMode) {
    setLastMode(mode);
    if (mode === "offline" && dirty && problem === null) setStored("waiting");
  }

  // Async code reads the latest values through refs; they are kept in step after each render.
  const latest = useRef({ value, saved, mode });
  useEffect(() => {
    latest.current = { value, saved, mode };
  });
  /** The save after the typing pause, while it is pending (undefined otherwise). */
  const typingTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  /** A save asked for while one was running (null: none); true if it should show a broken rule. */
  const queued = useRef<boolean | null>(null);
  /** The connection came back while a save was on its way: if that save fails, try once more. */
  const reconnected = useRef(false);

  function cancelTypingTimer() {
    window.clearTimeout(typingTimer.current);
    typingTimer.current = undefined;
  }

  // Leaving the page: Next.js keeps it mounted but hidden (React Activity), which runs this
  // cleanup, often with no blur first (Back with a key or a swipe). A change still waiting for the
  // typing pause saves now instead of being dropped. ("Saved" clears on its own timer, which keeps
  // running, so it can't stick when the page shows again.)
  const saveBeforeHiding = useEffectEvent(() => {
    if (typingTimer.current !== undefined) void persist(false);
  });
  useEffect(() => () => saveBeforeHiding(), []);

  async function persist(showProblem: boolean): Promise<void> {
    cancelTypingTimer();
    const { value: current, saved: confirmed } = latest.current;
    const issue = check?.(current) ?? null;
    const step = nextSaveStep({
      mode: effectiveMode(latest.current.mode),
      busy: busy.current,
      problem: issue,
      value: current,
      saved: confirmed,
    });
    if (step === "blocked") return;
    if (step === "queue") {
      // The running save looks at the latest text when it ends.
      queued.current = (queued.current ?? false) || showProblem;
      return;
    }
    if (step !== "save") {
      if (step === "problem") setError((shown) => (showProblem || shown !== null ? issue : shown));
      if (step === "unchanged") {
        // Back to the saved text: nothing on this field is failed any more.
        setError(null);
        page.clearFailure(failureKey);
      }
      setStored((s) => statusAfterStep(step, s));
      return;
    }

    busy.current = true;
    window.clearTimeout(savedTimer.current);
    setStored("saving");
    // The page's save-failed banner stays until a save succeeds: clearing it here would make it
    // (a role="alert") go and come back, and be announced again, at every failed attempt.
    const result = await safeCall(() => save(current));
    busy.current = false;
    const again = queued.current ?? false;
    queued.current = null;
    const backOnline = reconnected.current;
    reconnected.current = false;

    if (result.ok) {
      latest.current = { ...latest.current, saved: current };
      setSaved(current);
      setError(null);
      page.clearFailure(failureKey);
      if (afterSaveSucceeded(current, latest.current.value) === "again") return persist(again);
      setStored("saved");
      savedTimer.current = window.setTimeout(() => setStored((s) => (s === "saved" ? "idle" : s)), SAVED_VISIBLE_MS);
      return;
    }
    const outcome = afterSaveFailed(result.error.code, {
      online: navigator.onLine,
      changed: latest.current.value !== current,
      reconnected: backOnline,
    });
    switch (outcome) {
      case "again":
        return persist(again);
      case "invalid":
        setError(result.error.message);
        setStored("idle");
        return;
      case "signed-out":
        page.markSignedOut();
        setStored("error");
        return;
      case "waiting":
        setStored("waiting");
        return;
      default:
        setStored("error");
        page.reportFailure(failureKey);
    }
  }

  // Back online: an unsaved or failed change saves by itself, once (Try again after that). If a
  // save is still on its way, it is the one: it shows as saving, and if it fails with the drop it
  // is tried once more.
  const saveOnReconnect = useEffectEvent(() => {
    if (latest.current.value === latest.current.saved) return;
    if (busy.current) {
      reconnected.current = true;
      setStored("saving");
    }
    void persist(false);
  });
  const previousMode = useRef(mode);
  useEffect(() => {
    const was = previousMode.current;
    previousMode.current = mode;
    if (was === "offline" && mode === "write") saveOnReconnect();
  }, [mode]);

  // Tell the page about unsaved text, for the signed-out banner ("Copy any text you typed").
  const unsaved = page.unsaved;
  useEffect(() => {
    if (!dirty) return;
    unsaved.set(failureKey, true);
    return () => unsaved.set(failureKey, false);
  }, [dirty, unsaved, failureKey]);

  return {
    value,
    saved,
    status: shownStatus(stored, { mode, dirty, problem: problem !== null }),
    error,
    onChange(next) {
      setValue(next);
      latest.current = { ...latest.current, value: next };
      // "Saved" belongs to the text before this change.
      setStored((s) => (s === "saved" ? "idle" : s));
      // A shown problem goes away as soon as the field is fixed.
      if (error && !(check?.(next) ?? null)) setError(null);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => void persist(false), AUTOSAVE_DELAY_MS);
    },
    flush: () => void persist(true),
    hold: cancelTypingTimer,
    retry: () => void persist(true),
  };
}
