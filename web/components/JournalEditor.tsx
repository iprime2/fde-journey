"use client";

// Weekly notes on Career (design spec 4, JournalEditor): one textarea labelled by the card
// heading, saved like a note (800 ms after typing stops and on blur).
import { useId } from "react";
import { saveJournal } from "@/app/actions/progress";
import { JOURNAL_ID } from "@/lib/ids";
import { statusText } from "@/lib/save-state";
import { cn } from "./cn";
import { useCanWrite, useSaveStatus } from "./save/SaveStatusProvider";
import { useFieldSaver } from "./save/useFieldSaver";

export function JournalEditor({ note, labelledBy, readOnly }: { note: string; labelledBy: string; readOnly: boolean }) {
  const canWrite = useCanWrite(readOnly);
  const page = useSaveStatus();
  const errorId = useId();
  const field = useFieldSaver({ serverValue: note, save: saveJournal, failureKey: `note:${JOURNAL_ID}`, canWrite });
  return (
    <div id={`item-${JOURNAL_ID}`} className="grid gap-1.5 border-t border-line px-4 pt-3 pb-4">
      <textarea
        aria-labelledby={labelledBy}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.flush}
        readOnly={!canWrite}
        placeholder="What did you complete this week? What is blocking you?"
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.error ? errorId : undefined}
        className={cn(
          "type-input min-h-40 w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-ink [overflow-wrap:anywhere]",
          "read-only:cursor-not-allowed read-only:opacity-50",
          field.error ? "border-danger" : "border-line-strong",
        )}
      />
      {field.error && (
        <p id={errorId} className="type-small text-danger">
          {field.error}
        </p>
      )}
      <p aria-live="polite" className={cn("type-num min-h-[1.4em]", field.status === "error" ? "text-danger" : "text-muted")}>
        {statusText(field.status)}
        {field.status === "error" && !page.signedOut && (
          <>
            {" "}
            <button
              type="button"
              onClick={field.retry}
              disabled={!canWrite}
              className="font-sans underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Try again
            </button>
          </>
        )}
      </p>
    </div>
  );
}
