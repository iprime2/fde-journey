"use client";

// NoteButton, NotePreview, NoteEditor and their status lines for one item row (design spec 4).
// They render as grid items of the row: the button sits right of the text on desktop and under it
// on phones; the preview, the editor and the status lines sit under the text.
//
// Closing the editor always closes it (spec option (b)). Anything not saved stays visible in the
// collapsed row: the preview shows the typed text, and a line under it says what is wrong, with
// Try again, Fix link or Fix note.
import { useEffect, useId, useRef, useState } from "react";
import { saveLink, saveNote } from "@/app/actions/progress";
import { linkProblem, noteProblem } from "@/lib/notes";
import { CLOSED_SAVING_DELAY_MS, type LineAction, combineStatus, noteButtonLabel, saveLines } from "@/lib/save-state";
import { cn } from "../cn";
import { SaveLines, describedByIds } from "../save/SaveLines";
import { useFieldMode, useSaveStatus } from "../save/SaveStatusProvider";
import { type FieldSaver, useFieldSaver } from "../save/useFieldSaver";
import { FIELD_STYLES } from "../save/fieldStyles";
import { NotePreview } from "./NotePreview";

/** Text column; from md, the text column and the note button column (spec, NotePreview). */
const UNDER_TEXT = "col-start-2 md:col-end-[-1]";

export function NoteArea({
  itemId,
  title,
  note,
  link,
  placeholder,
  readOnly,
}: {
  itemId: string;
  title: string;
  note: string;
  link: string;
  placeholder: string;
  readOnly: boolean;
}) {
  const mode = useFieldMode(readOnly);
  const page = useSaveStatus();
  const [open, setOpen] = useState(false);
  /** Which field opening the editor focuses: the note, or the link after "Fix link". */
  const [focusField, setFocusField] = useState<"note" | "link">("note");
  const button = useRef<HTMLButtonElement>(null);
  /** The status lines (they hold Try again while the editor is open). */
  const linesArea = useRef<HTMLDivElement>(null);
  const editorId = useId();
  const noteErrorId = useId();
  const linkErrorId = useId();
  const ids = { saving: useId(), save: useId(), field: useId() };

  const noteField = useFieldSaver({
    serverValue: note,
    save: (value) => saveNote(itemId, value),
    check: noteProblem,
    failureKey: `note:${itemId}`,
    mode,
  });
  const linkField = useFieldSaver({
    serverValue: link,
    save: (value) => saveLink(itemId, value),
    check: linkProblem,
    failureKey: `link:${itemId}`,
    mode,
  });

  const status = combineStatus([noteField.status, linkField.status]);
  const hasText = noteField.value !== "" || linkField.value !== "";
  const label = noteButtonLabel(open, hasText);

  // The collapsed row says "Saving…" only once a save has been running for 1 s since closing
  // (a normal close shows no line at all), or at once after its Try again.
  const closedSaving = !open && status === "saving";
  const [slow, setSlow] = useState(false);
  const [retried, setRetried] = useState(false);
  const [wasClosedSaving, setWasClosedSaving] = useState(closedSaving);
  if (closedSaving !== wasClosedSaving) {
    setWasClosedSaving(closedSaving);
    setSlow(false);
  }
  if (retried && !closedSaving) setRetried(false);
  useEffect(() => {
    if (!closedSaving) return;
    const timer = window.setTimeout(() => setSlow(true), CLOSED_SAVING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [closedSaving]);

  const lines = saveLines({
    fields: [
      { kind: "note", status: noteField.status, error: noteField.error },
      { kind: "link", status: linkField.status, error: linkField.error },
    ],
    signedOut: page.signedOut,
    savingShown: open || slow || retried,
  });

  function openEditor(target: "note" | "link") {
    setFocusField(target);
    setOpen(true);
  }

  /** Hide note and Escape: start saving anything changed, then close at once. */
  function close() {
    noteField.flush();
    linkField.flush();
    setOpen(false);
  }

  function retry() {
    // Try again goes away once the save starts, so focus moves to the note button first.
    button.current?.focus();
    if (!open) setRetried(true);
    noteField.retry();
    linkField.retry();
  }

  function onAction(action: LineAction) {
    if (action === "retry") retry();
    else openEditor(action === "fix-link" ? "link" : "note");
  }

  /**
   * Leaving a field saves it, except when focus moves to Try again (Tab after a failed save): Try
   * again saves both fields, and a save started by the blur would remove it as focus arrives.
   */
  function onFieldBlur(field: FieldSaver, e: React.FocusEvent) {
    if (e.relatedTarget instanceof Node && linesArea.current?.contains(e.relatedTarget)) field.hold();
    else field.flush();
  }

  function onEscape(e: React.KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
    button.current?.focus();
  }

  return (
    <>
      <div className="col-start-2 -mt-1 mb-1 md:col-start-3 md:row-start-1 md:mt-1.5 md:mb-0 md:self-start">
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={open ? editorId : undefined}
          // While the collapsed row says something isn't saved, the button reads it ("Edit note, Not saved.").
          aria-describedby={open ? undefined : describedByIds(lines, ids)}
          onClick={() => (open ? close() : openEditor("note"))}
          className={cn(
            // 32 px visible, 44 px to tap (the ::after adds 6 px above and below).
            "relative inline-flex h-8 items-center rounded-md px-3 type-small font-medium whitespace-nowrap",
            "after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']",
            "motion-safe:transition-[color,background-color,border-color] motion-safe:duration-150 hover:border-accent hover:text-accent",
            label === "Edit note" ? "border border-transparent bg-accent-soft text-accent" : "border border-line-strong text-muted",
          )}
        >
          {label}
        </button>
      </div>

      {!open && hasText && (
        <div className={cn(UNDER_TEXT, "pb-2")}>
          {/* The typed text, so an unsaved change is never hidden behind the old one. */}
          <NotePreview note={noteField.value} link={linkField.value} />
        </div>
      )}

      {open && (
        <div id={editorId} className={cn(UNDER_TEXT, "grid gap-2 pt-1")} onKeyDown={onEscape}>
          <label className="sr-only" htmlFor={`${editorId}-note`}>
            Note for {title}
          </label>
          <textarea
            id={`${editorId}-note`}
            // Opening the editor focuses the note (it only mounts when opened), or the link after Fix link.
            autoFocus={focusField === "note"}
            value={noteField.value}
            onChange={(e) => noteField.onChange(e.target.value)}
            onBlur={(e) => onFieldBlur(noteField, e)}
            readOnly={mode === "read-only"}
            placeholder={placeholder}
            aria-invalid={noteField.error ? true : undefined}
            aria-describedby={noteField.error ? noteErrorId : undefined}
            className={cn(FIELD_STYLES, "min-h-24 resize-y", noteField.error ? "border-danger" : "border-line-strong")}
          />
          {noteField.error && (
            <p id={noteErrorId} className="type-small text-danger">
              {noteField.error}
            </p>
          )}
          <label className="sr-only" htmlFor={`${editorId}-link`}>
            Link for {title}
          </label>
          <input
            id={`${editorId}-link`}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoFocus={focusField === "link"}
            value={linkField.value}
            onChange={(e) => linkField.onChange(e.target.value)}
            onBlur={(e) => onFieldBlur(linkField, e)}
            readOnly={mode === "read-only"}
            placeholder="https://…"
            aria-invalid={linkField.error ? true : undefined}
            aria-describedby={linkField.error ? linkErrorId : undefined}
            className={cn(FIELD_STYLES, "h-11", linkField.error ? "border-danger" : "border-line-strong")}
          />
          {linkField.error && (
            <p id={linkErrorId} className="type-small text-danger">
              {linkField.error}
            </p>
          )}
        </div>
      )}

      {/* Always rendered: it holds the note's live region, open or closed. */}
      <div
        ref={linesArea}
        className={cn(
          UNDER_TEXT,
          open ? "type-num flex min-h-11 flex-wrap items-center gap-x-2 pb-2" : "type-small max-w-[34em] [overflow-wrap:anywhere]",
          !open && (lines.saving || lines.save || lines.field) && "-mt-1 pb-2",
        )}
        onKeyDown={open ? onEscape : undefined}
      >
        <SaveLines lines={lines} editing={open} ids={ids} onAction={onAction} fallbackFocus={() => button.current?.focus()} />
      </div>
    </>
  );
}
