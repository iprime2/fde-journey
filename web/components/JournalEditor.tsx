"use client";

// Weekly notes on Career (design spec 4, JournalEditor): one textarea labelled by the card
// heading, saved like a note (800 ms after typing stops and on blur), with the same status line,
// announcements, offline and read-only behaviour. It never closes, so there is no collapsed row.
import { useId, useRef } from "react";
import { saveJournal } from "@/app/actions/progress";
import { JOURNAL_ID } from "@/lib/ids";
import { saveLines } from "@/lib/save-state";
import { cn } from "./cn";
import { FIELD_STYLES } from "./save/fieldStyles";
import { SaveLines } from "./save/SaveLines";
import { useFieldMode, useSaveStatus } from "./save/SaveStatusProvider";
import { useFieldSaver } from "./save/useFieldSaver";

export function JournalEditor({ note, labelledBy, readOnly }: { note: string; labelledBy: string; readOnly: boolean }) {
  const mode = useFieldMode(readOnly);
  const page = useSaveStatus();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const ids = { saving: useId(), save: useId(), field: useId() };
  const field = useFieldSaver({ serverValue: note, save: saveJournal, failureKey: `note:${JOURNAL_ID}`, mode });
  const lines = saveLines({
    fields: [{ kind: "journal", status: field.status, error: field.error }],
    signedOut: page.signedOut,
    savingShown: true,
  });

  function retry() {
    // Try again goes away once the save starts, so focus moves to the textarea first.
    textarea.current?.focus();
    field.retry();
  }

  return (
    <div id={`item-${JOURNAL_ID}`} className="grid gap-1.5 border-t border-line px-4 pt-3 pb-2">
      <textarea
        ref={textarea}
        aria-labelledby={labelledBy}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.flush}
        readOnly={mode === "read-only"}
        placeholder="What did you complete this week? What is blocking you?"
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.error ? errorId : undefined}
        className={cn(FIELD_STYLES, "min-h-40 resize-y", field.error ? "border-danger" : "border-line-strong")}
      />
      {field.error && (
        <p id={errorId} className="type-small text-danger">
          {field.error}
        </p>
      )}
      {/* In the page from the first render: it holds the live region. */}
      <div className="type-num flex min-h-11 flex-wrap items-center gap-x-2">
        <SaveLines lines={lines} editing ids={ids} onAction={retry} />
      </div>
    </div>
  );
}
