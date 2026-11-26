"use client";

// The status lines under a note or the weekly notes (design spec 4, NoteEditor, "Announcements"
// and "Closing with unsaved changes"). One polite live region, rendered from the first paint and
// whether the editor is open or closed, announces "Saved", "Not saved.", "Not saved yet…" and
// field problems. "Saving…" sits outside it, so each save is announced as one word.
//
// Opening and closing a note only changes which lines are visible, never their text, so toggling
// the editor announces nothing new.
import { type LineAction, type LineTone, SAVE_TEXT, type SaveLines as Lines } from "@/lib/save-state";
import { cn } from "../cn";

const TONES: Record<LineTone, string> = { muted: "text-muted", danger: "text-danger", warn: "text-warn" };

const ACTION_LABELS: Record<LineAction, string> = { retry: "Try again", "fix-link": "Fix link", "fix-note": "Fix note" };

/** Ids of the message parts, for aria-describedby on the actions and the note button. */
export interface LineIds {
  saving: string;
  save: string;
  field: string;
}

/** "Try again", "Fix link", "Fix note": underlined text buttons with a 44 px tall hit area. */
export function InlineButton({
  children,
  describedBy,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  describedBy?: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      // Don't take focus on press: blurring the field being typed in would start a save, which
      // removes this button before the click lands and drops focus on the page. The click
      // handler moves focus itself.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedBy}
      className="inline-flex min-h-11 items-center font-sans underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SaveLines({
  lines,
  editing,
  ids,
  onAction,
}: {
  lines: Lines;
  /** The editor is open: "Saved" shows; field problems are shown under their fields instead. */
  editing: boolean;
  ids: LineIds;
  onAction(action: LineAction): void;
}) {
  const { save, field } = lines;
  const saveAction = save?.action ?? null;
  const fieldAction = !editing ? (field?.action ?? null) : null;
  return (
    <>
      {lines.saving && (
        <p id={ids.saving} className="text-muted">
          {SAVE_TEXT.saving}
        </p>
      )}
      <div aria-live="polite">
        {lines.saved && <p className={cn("text-muted", !editing && "sr-only")}>{SAVE_TEXT.saved}</p>}
        {save && (
          <p className={TONES[save.tone]}>
            <span id={ids.save}>{save.text}</span>
            {saveAction && (
              <>
                {" "}
                <InlineButton describedBy={ids.save} onClick={() => onAction(saveAction)}>
                  {ACTION_LABELS[saveAction]}
                </InlineButton>
              </>
            )}
          </p>
        )}
        {field && (
          <p className={cn(TONES[field.tone], editing && "sr-only")}>
            <span id={ids.field}>{field.text}</span>
            {fieldAction && (
              <>
                {" "}
                <InlineButton describedBy={ids.field} onClick={() => onAction(fieldAction)}>
                  {ACTION_LABELS[fieldAction]}
                </InlineButton>
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}

/** The ids the note button is described by while the collapsed row shows an unsaved line. */
export function describedByIds(lines: Lines, ids: LineIds): string | undefined {
  const parts = [lines.saving && ids.saving, lines.save && ids.save, lines.field && ids.field].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}
