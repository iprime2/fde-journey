"use client";

// NoteButton, NotePreview and NoteEditor for one item row (design spec 4). They render as grid
// items of the row: the button sits right of the text on desktop and under it on phones; the
// preview and the editor sit under the text.
import { useId, useRef, useState } from "react";
import { saveLink, saveNote } from "@/app/actions/progress";
import { linkProblem } from "@/lib/notes";
import { combineStatus, noteButtonLabel, statusText } from "@/lib/save-state";
import { cn } from "../cn";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { useFieldSaver } from "../save/useFieldSaver";
import { NotePreview } from "./NotePreview";

const FIELD =
  "type-input w-full rounded-md border bg-surface px-3 py-2.5 text-ink [overflow-wrap:anywhere] read-only:cursor-not-allowed read-only:opacity-50";

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
  const canWrite = useCanWrite(readOnly);
  const page = useSaveStatus();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const editorId = useId();
  const noteErrorId = useId();
  const linkErrorId = useId();

  const noteField = useFieldSaver({
    serverValue: note,
    save: (value) => saveNote(itemId, value),
    failureKey: `note:${itemId}`,
    canWrite,
  });
  const linkField = useFieldSaver({
    serverValue: link,
    save: (value) => saveLink(itemId, value),
    check: linkProblem,
    failureKey: `link:${itemId}`,
    canWrite,
  });

  const status = combineStatus([noteField.status, linkField.status]);
  const hasSaved = noteField.saved !== "" || linkField.saved !== "";
  const label = noteButtonLabel(open, hasSaved);

  function close() {
    noteField.flush();
    linkField.flush();
    setOpen(false);
  }

  return (
    <>
      <div className="col-start-2 -mt-1 mb-1 md:col-start-3 md:row-start-1 md:mt-1.5 md:mb-0 md:self-start">
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={open ? editorId : undefined}
          onClick={() => (open ? close() : setOpen(true))}
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

      {!open && hasSaved && (
        <div className="col-start-2 pb-2 md:col-span-2">
          <NotePreview note={noteField.saved} link={linkField.saved} />
        </div>
      )}

      {open && (
        <div
          id={editorId}
          className="col-start-2 col-end-[-1] grid gap-2 pb-3"
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            close();
            button.current?.focus();
          }}
        >
          <label className="sr-only" htmlFor={`${editorId}-note`}>
            Note for {title}
          </label>
          <textarea
            id={`${editorId}-note`}
            // Opening the editor focuses the note (it only mounts when opened).
            autoFocus
            value={noteField.value}
            onChange={(e) => noteField.onChange(e.target.value)}
            onBlur={noteField.flush}
            readOnly={!canWrite}
            placeholder={placeholder}
            aria-invalid={noteField.error ? true : undefined}
            aria-describedby={noteField.error ? noteErrorId : undefined}
            className={cn(FIELD, "min-h-24 resize-y", noteField.error ? "border-danger" : "border-line-strong")}
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
            value={linkField.value}
            onChange={(e) => linkField.onChange(e.target.value)}
            onBlur={linkField.flush}
            readOnly={!canWrite}
            placeholder="https://…"
            aria-invalid={linkField.error ? true : undefined}
            aria-describedby={linkField.error ? linkErrorId : undefined}
            className={cn(FIELD, "h-11", linkField.error ? "border-danger" : "border-line-strong")}
          />
          {linkField.error && (
            <p id={linkErrorId} className="type-small text-danger">
              {linkField.error}
            </p>
          )}
          <p aria-live="polite" className={cn("type-num min-h-[1.4em]", status === "error" ? "text-danger" : "text-muted")}>
            {statusText(status)}
            {status === "error" && !page.signedOut && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    noteField.retry();
                    linkField.retry();
                  }}
                  disabled={!canWrite}
                  className="font-sans underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Try again
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </>
  );
}
