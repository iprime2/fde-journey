"use client";

// The status lines under a note or the weekly notes (design spec 4, NoteEditor, "Announcements"
// and "Closing with unsaved changes").
//
// Announcements: one polite live region, rendered from the first paint and whether the editor is
// open or closed. It holds text only ("Saved", "Not saved.", "Not saved yet…", field problems),
// never the Try again / Fix buttons, and is visually hidden. The visible lines below say the same
// (their text is aria-hidden so screen readers don't read it twice) and carry the buttons.
// "Saving…" is shown but never announced, so each save is announced as one word.
//
// Opening and closing a note only changes which lines are visible, never the announced text, so
// toggling the editor announces nothing new.
import { useEffectEvent, useLayoutEffect, useRef } from "react";
import { type LineAction, type LineTone, SAVE_TEXT, type SaveLines as Lines } from "@/lib/save-state";

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
  onRemovedWhileFocused,
}: {
  children: React.ReactNode;
  describedBy?: string;
  onClick(): void;
  disabled?: boolean;
  /**
   * The button went away while it had focus, for a reason other than its own click (which moves
   * focus first), e.g. the connection dropped. Move focus somewhere that stays.
   */
  onRemovedWhileFocused?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const removed = useEffectEvent(() => onRemovedWhileFocused?.());
  // Layout cleanups run before React takes the button out of the page, so focus can still move.
  useLayoutEffect(() => {
    const button = ref.current;
    return () => {
      if (button && document.activeElement === button) removed();
    };
  }, []);
  return (
    <button
      ref={ref}
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
  fallbackFocus,
}: {
  lines: Lines;
  /** The editor is open: "Saved" shows; field problems are shown under their fields instead. */
  editing: boolean;
  ids: LineIds;
  onAction(action: LineAction): void;
  /** Where focus goes if a focused button here disappears on its own. */
  fallbackFocus(): void;
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
      {/* role="status" is a polite live region; it lets tests and tools find the announcements. */}
      <div role="status" aria-live="polite" className="sr-only">
        {lines.saved && <p>{SAVE_TEXT.saved}</p>}
        {save && <p>{save.text}</p>}
        {field && <p>{field.text}</p>}
      </div>
      {editing && lines.saved && (
        <p aria-hidden="true" className="text-muted">
          {SAVE_TEXT.saved}
        </p>
      )}
      {save && (
        <p className={TONES[save.tone]}>
          <span id={ids.save} aria-hidden="true">
            {save.text}
          </span>
          {saveAction && (
            <>
              {" "}
              <InlineButton describedBy={ids.save} onClick={() => onAction(saveAction)} onRemovedWhileFocused={fallbackFocus}>
                {ACTION_LABELS[saveAction]}
              </InlineButton>
            </>
          )}
        </p>
      )}
      {field && !editing && (
        <p className={TONES[field.tone]}>
          <span id={ids.field} aria-hidden="true">
            {field.text}
          </span>
          {fieldAction && (
            <>
              {" "}
              <InlineButton describedBy={ids.field} onClick={() => onAction(fieldAction)} onRemovedWhileFocused={fallbackFocus}>
                {ACTION_LABELS[fieldAction]}
              </InlineButton>
            </>
          )}
        </p>
      )}
    </>
  );
}

/** The ids the note button is described by while the collapsed row shows an unsaved line. */
export function describedByIds(lines: Lines, ids: LineIds): string | undefined {
  const parts = [lines.saving && ids.saving, lines.save && ids.save, lines.field && ids.field].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}
